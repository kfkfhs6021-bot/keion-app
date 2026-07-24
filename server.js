const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'reservations.json');

app.use(express.json());

// JSONデータの読み込み
const loadReservations = () => {
  if (!fs.existsSync(DATA_FILE)) {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify([]));
    } catch (e) {
      return []; // Read-only環境対策
    }
  }
  try {
    const data = fs.readFileSync(DATA_FILE);
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
};

// JSONデータの保存
const saveReservations = (data) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Save error:', e);
  }
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

// UI画面（カレンダー機能つき）
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>🎸 軽音部 スタジオ予約</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px 15px; background: #f4f6f8; color: #333; }
        h1 { text-align: center; color: #111; font-size: 1.5em; margin-bottom: 20px; }
        .card { background: #fff; padding: 20px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 20px; }
        .card h3 { margin-top: 0; color: #007bff; border-bottom: 2px solid #f0f0f0; padding-bottom: 8px; font-size: 1.1em; }
        
        label { display: block; margin-top: 12px; font-weight: 600; font-size: 0.85em; color: #666; }
        input { width: 100%; padding: 10px; margin-top: 4px; border: 1px solid #ccc; border-radius: 6px; font-size: 0.95em; }
        button.btn-primary { width: 100%; margin-top: 18px; background: #007bff; color: white; border: none; padding: 12px; font-size: 1em; font-weight: bold; border-radius: 6px; cursor: pointer; }
        button.btn-primary:hover { background: #0056b3; }
        
        /* カレンダー日付切替枠 */
        .date-picker-wrapper { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 15px; background: #eef5ff; padding: 10px 15px; border-radius: 8px; }
        .date-picker-wrapper label { margin: 0; white-space: nowrap; color: #007bff; font-weight: bold; }
        .date-picker-wrapper input { margin-top: 0; font-weight: bold; text-align: center; border: 1px solid #b8daff; background: #fff; }

        /* タイムテーブル風カード */
        .timeline-item { display: flex; align-items: center; justify-content: space-between; background: #f8f9fa; border-left: 5px solid #007bff; padding: 12px 15px; border-radius: 6px; margin-bottom: 10px; }
        .time-badge { font-weight: bold; color: #007bff; font-size: 1.05em; }
        .band-name { font-size: 1em; font-weight: 600; color: #222; margin-top: 3px; }
        .del-btn { background: #dc3545; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 0.8em; cursor: pointer; }
        .no-data { text-align: center; color: #888; padding: 25px 0; font-size: 0.9em; }
      </style>
    </head>
    <body>
      <h1>🎸 軽音部 スタジオ予約</h1>
      
      <!-- 予約フォーム -->
      <div class="card">
        <h3>➕ 新規予約</h3>
        <label>バンド名 / お名前</label>
        <input type="text" id="name" placeholder="例: Aバンド（山田）">
        
        <label>開始日時</label>
        <input type="datetime-local" id="startTime">
        
        <label>終了日時</label>
        <input type="datetime-local" id="endTime">
        
        <button class="btn-primary" onclick="addReservation()">予約を登録する</button>
      </div>

      <!-- 日別スケジュール表示 -->
      <div class="card">
        <h3>📅 予約スケジュール</h3>
        
        <div class="date-picker-wrapper">
          <label>表示する日付:</label>
          <input type="date" id="selectedDate" onchange="renderSchedule()">
        </div>

        <div id="scheduleList">読み込み中...</div>
      </div>

      <script>
        let allReservations = [];

        // 初期化：今日の日付をセット
        document.getElementById('selectedDate').value = new Date().toISOString().split('T')[0];

        async function fetchReservations() {
          const res = await fetch('/api/reservations');
          allReservations = await res.json();
          renderSchedule();
        }

        function renderSchedule() {
          const selectedDate = document.getElementById('selectedDate').value;
          const listEl = document.getElementById('scheduleList');

          if (!selectedDate) return;

          // 選択された日付の予約だけを抽出
          const filtered = allReservations.filter(r => {
            const dateStr = r.startTime.split('T')[0];
            return dateStr === selectedDate;
          });

          if (filtered.length === 0) {
            listEl.innerHTML = '<div class="no-data">☕ この日の予約はありません（空き）</div>';
            return;
          }

          listEl.innerHTML = filtered.map(r => {
            const start = new Date(r.startTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
            const end = new Date(r.endTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
            return \`
              <div class="timeline-item">
                <div>
                  <div class="time-badge">⏰ \${start} 〜 \${end}</div>
                  <div class="band-name">🎸 \${r.name}</div>
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

          const res = await fetch('/api/reservations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, startTime, endTime })
          });

          if (res.ok) {
            // 登録した日を表示日に合わせて画面更新
            document.getElementById('selectedDate').value = startTime.split('T')[0];
            document.getElementById('name').value = '';
            document.getElementById('startTime').value = '';
            document.getElementById('endTime').value = '';
            fetchReservations();
          } else {
            alert('予約の登録に失敗しました');
          }
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
  console.log(`サーバー起動中: port ${PORT}`);
});