import express from 'express';

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 予約データ（メモリ保存）
let reservations = [
  { id: 1, date: '2026-07-24', time: '10:00', name: '山田 太郎', detail: 'バンド練習' },
  { id: 2, date: '2026-07-25', time: '14:30', name: '佐藤 花子', detail: '個人練習' },
];

// メインページ（カレンダー表示）
app.get('/', (req, res) => {
  // 00:00 〜 23:00 の24時間分のタイムスロット
  const timeSlots = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
  
  // 今日から2週間分（14日間）の日付リストを生成
  const dates = [];
  const today = new Date();

  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
    
    dates.push({
      formatted: `${year}-${month}-${date}`,
      label: `${month}/${date}(${dayOfWeek})`
    });
  }

  const html = `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>スタジオ予約表</title>
      <style>
        body { font-family: sans-serif; padding: 15px; background: #f9fafb; margin: 0; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.05); }
        h2 { text-align: center; color: #111827; margin-top: 0; margin-bottom: 12px; font-size: 22px; }
        
        .header-actions { text-align: center; margin-bottom: 16px; }
        .btn-custom-add { background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2); }
        .btn-custom-add:hover { background: #1d4ed8; }

        .table-wrapper { overflow-x: auto; max-height: 70vh; overflow-y: auto; -webkit-overflow-scrolling: touch; border: 1px solid #e5e7eb; border-radius: 6px; }
        table { width: 100%; min-width: 1000px; border-collapse: collapse; }
        th, td { border: 1px solid #e5e7eb; padding: 6px; text-align: center; }
        th { background: #f3f4f6; font-size: 13px; min-width: 90px; position: sticky; top: 0; z-index: 2; }
        .time-col { background: #f9fafb; font-weight: bold; width: 60px; position: sticky; left: 0; z-index: 3; font-size: 12px; color: #4b5563; }
        
        /* 空きマスをクリック可能に */
        .grid-cell { cursor: pointer; height: 48px; vertical-align: top; transition: background-color 0.15s; }
        .grid-cell:hover { background-color: #f3f4f6; }
        
        /* 予約カードのデザイン */
        .booking-card { background: #dbeafe; color: #1e3a8a; padding: 6px 8px; border-radius: 6px; font-size: 12px; text-align: left; position: relative; margin-bottom: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .booking-card strong { display: block; margin-right: 18px; }
        .delete-btn { position: absolute; top: 4px; right: 4px; background: #ef4444; color: white; border: none; border-radius: 50%; width: 18px; height: 18px; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; line-height: 1; }
        .delete-btn:hover { background: #dc2626; }
        
        /* モーダル */
        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); justify-content: center; align-items: center; z-index: 100; }
        .modal-content { background: white; padding: 20px; border-radius: 8px; width: 300px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
        .form-group { margin-bottom: 12px; text-align: left; }
        .form-group label { display: block; font-size: 12px; font-weight: bold; margin-bottom: 4px; color: #374151; }
        .form-group input { width: 100%; padding: 8px; box-sizing: border-box; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; }
        .btn-submit { background: #2563eb; color: white; border: none; padding: 10px; width: 100%; border-radius: 4px; cursor: pointer; font-weight: bold; margin-top: 8px; font-size: 14px; }
        .btn-cancel { background: #9ca3af; color: white; border: none; padding: 6px; width: 100%; border-radius: 4px; cursor: pointer; margin-top: 6px; font-size: 13px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>スタジオ予約表</h2>
        <div class="header-actions">
          <button class="btn-custom-add" onclick="openForm('', '')">＋ 新規予約を追加</button>
        </div>
        
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th class="time-col" style="z-index: 4;">時間</th>
                ${dates.map(d => `<th>${d.label}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${timeSlots.map(time => {
                const hourPrefix = time.substring(0, 2);
                
                return `
                  <tr>
                    <td class="time-col">${time}</td>
                    ${dates.map(d => {
                      const cellBookings = reservations.filter(r => r.date === d.formatted && r.time.startsWith(hourPrefix));
                      
                      return `
                        <td class="grid-cell" onclick="openForm('${d.formatted}', '${time}')">
                          ${cellBookings.map(b => `
                            <div class="booking-card" onclick="event.stopPropagation();">
                              <form action="/delete-reserve" method="POST" style="display:inline;" onsubmit="return confirm('${b.name}様の予約を削除しますか？');">
                                <input type="hidden" name="id" value="${b.id}">
                                <button type="submit" class="delete-btn" title="予約を削除">×</button>
                              </form>
                              <strong>${b.name} 様 (${b.time})</strong>
                              <div style="font-size: 10px; margin-top: 2px;">${b.detail}</div>
                            </div>
                          `).join('')}
                        </td>
                      `;
                    }).join('')}
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 予約登録モーダル -->
      <div id="reservationModal" class="modal">
        <div class="modal-content">
          <h3 style="margin-top: 0; font-size: 16px; color: #111827;">新規予約の登録</h3>
          <form action="/reserve" method="POST">
            <div class="form-group">
              <label for="formDate">日付</label>
              <input type="date" id="formDate" name="date" required>
            </div>

            <div class="form-group">
              <label for="formTime">時間（自由に入力可能）</label>
              <input type="time" id="formTime" name="time" required>
            </div>
            
            <div class="form-group">
              <label for="name">お名前</label>
              <input type="text" id="name" name="name" required placeholder="例：高橋 健太">
            </div>
            
            <div class="form-group">
              <label for="detail">内容・メモ</label>
              <input type="text" id="detail" name="detail" placeholder="例：Aスタジオ / 2時間">
            </div>
            
            <button type="submit" class="btn-submit">予約を確定する</button>
            <button type="button" class="btn-cancel" onclick="closeForm()">キャンセル</button>
          </form>
        </div>
      </div>

      <script>
        function openForm(date, time) {
          if (date) {
            document.getElementById('formDate').value = date;
          } else {
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('formDate').value = today;
          }

          if (time) {
            document.getElementById('formTime').value = time;
          } else {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            document.getElementById('formTime').value = hours + ':' + minutes;
          }

          document.getElementById('reservationModal').style.display = 'flex';
        }

        function closeForm() {
          document.getElementById('reservationModal').style.display = 'none';
        }
      </script>
    </body>
    </html>
  `;

  res.send(html);
});

// 予約追加処理
app.post('/reserve', (req, res) => {
  const { date, time, name, detail } = req.body;

  if (date && time && name) {
    reservations.push({
      id: Date.now(),
      date,
      time,
      name,
      detail: detail || '予約'
    });
  }

  res.redirect('/');
});

// 予約削除処理
app.post('/delete-reserve', (req, res) => {
  const { id } = req.body;

  if (id) {
    reservations = reservations.filter(r => r.id !== Number(id));
  }

  res.redirect('/');
});

export default app;