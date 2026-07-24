const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'reservations.json');

app.use(express.json());

// JSONデータの読み込み
const loadReservations = () => {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]));
  }
  const data = fs.readFileSync(DATA_FILE);
  return JSON.parse(data);
};

// JSONデータの保存
const saveReservations = (data) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

// 予約一覧API
app.get('/api/reservations', (req, res) => {
  const reservations = loadReservations();
  reservations.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  res.json(reservations);
});

// 予約追加API
app.post('/api/reservations', (req, res) => {
  const { name, startTime, endTime } = req.body;
  if (!name || !startTime || !endTime) {
    return res.status(400).json({ error: 'すべての項目を入力してください。' });
  }

  const reservations = loadReservations();
  const newReservation = {
    id: Date.now().toString(),
    name,
    startTime,
    endTime
  };

  reservations.push(newReservation);
  saveReservations(reservations);
  res.status(201).json(newReservation);
});

// 予約削除API
app.delete('/api/reservations/:id', (req, res) => {
  const { id } = req.params;
  let reservations = loadReservations();
  reservations = reservations.filter(r => r.id !== id);
  saveReservations(reservations);
  res.json({ message: '削除しました。' });
});

// アプリ画面（HTML）
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>軽音部 スタジオ予約</title>
      <style>
        body { font-family: sans-serif; max-width: 500px; margin: 20px auto; padding: 0 15px; background: #f9f9f9; }
        h1 { text-align: center; color: #333; }
        .card { background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
        label { display: block; margin-top: 10px; font-weight: bold; font-size: 0.9em; }
        input { width: 100%; padding: 10px; margin-top: 5px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; }
        button { width: 100%; margin-top: 15px; background: #007bff; color: white; border: none; padding: 12px; font-size: 1em; border-radius: 4px; cursor: pointer; }
        button:hover { background: #0056b3; }
        .item { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding: 12px 0; }
        .item:last-child { border-bottom: none; }
        .del-btn { background: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 4px; width: auto; margin-top: 0; cursor: pointer; }
        .time { font-size: 0.85em; color: #666; }
      </style>
    </head>
    <body>
      <h1>🎸 軽音部 スタジオ予約</h1>
      
      <div class="card">
        <h3>新規予約</h3>
        <label>バンド名 / お名前</label>
        <input type="text" id="name" placeholder="例: Aバンド（山田）">
        
        <label>開始日時</label>
        <input type="datetime-local" id="startTime">
        
        <label>終了日時</label>
        <input type="datetime-local" id="endTime">
        
        <button onclick="addReservation()">予約を登録する</button>
      </div>

      <div class="card">
        <h3>予約一覧</h3>
        <div id="list">読み込み中...</div>
      </div>

      <script>
        async function fetchReservations() {
          const res = await fetch('/api/reservations');
          const data = await res.json();
          const listEl = document.getElementById('list');
          
          if (data.length === 0) {
            listEl.innerHTML = '<p style="color:#888;">現在予約はありません。</p>';
            return;
          }

          listEl.innerHTML = data.map(r => {
            const start = new Date(r.startTime).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            const end = new Date(r.endTime).toLocaleString('ja-JP', { hour: '2-digit', minute: '2-digit' });
            return \`
              <div class="item">
                <div>
                  <strong>\${r.name}</strong><br>
                  <span class="time">\${start} 〜 \${end}</span>
                </div>
                <button class="del-btn" onclick="deleteReservation('\${r.id}')">削除</button>
              </div>
            \`;
          }).join('');
        }

        async function addReservation() {
          const name = document.getElementById('name').value;
          const startTime = document.getElementById('startTime').value;
          const endTime = document.getElementById('endTime').value;

          if (!name || !startTime || !endTime) {
            alert('すべての項目を入力してください');
            return;
          }

          await fetch('/api/reservations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, startTime, endTime })
          });

          document.getElementById('name').value = '';
          document.getElementById('startTime').value = '';
          document.getElementById('endTime').value = '';
          fetchReservations();
        }

        async function deleteReservation(id) {
          if (!confirm('この予約を削除しますか？')) return;
          await fetch('/api/reservations/' + id, { method: 'DELETE' });
          fetchReservations();
        }

        fetchReservations();
      </script>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`サーバーが起動しました: http://localhost:${PORT}`);
});