import express from 'express';

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 予約データ（メモリ保存）
let reservations = [
  { id: 1, date: '2026-07-24', time: '10:00', name: '山田 太郎', detail: '初回相談' },
  { id: 2, date: '2026-07-25', time: '14:00', name: '佐藤 花子', detail: '打ち合わせ' },
];

// メインページ（カレンダー表示）
app.get('/', (req, res) => {
  const timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
  
  // 今日から2週間分（14日間）の日付リストを動的に自動生成
  const dates = [];
  const today = new Date();

  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    
    // YYYY-MM-DD 形式の文字列を作成
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    
    // 曜日の表示用（例: 7/24(金)）
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
      <title>予約状況カレンダー（2週間）</title>
      <style>
        body { font-family: sans-serif; padding: 15px; background: #f9fafb; margin: 0; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.05); }
        h2 { text-align: center; color: #333; margin-top: 0; }
        
        /* 表が横長になってもスマホでスクロールできるように調整 */
        .table-wrapper { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        table { width: 100%; min-width: 1000px; border-collapse: collapse; margin-top: 15px; }
        th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: center; }
        th { background: #f3f4f6; font-size: 13px; min-width: 90px; }
        .time-col { background: #f9fafb; font-weight: bold; width: 70px; position: sticky; left: 0; z-index: 1; }
        
        .booking-card { background: #dbeafe; color: #1e3a8a; padding: 6px; border-radius: 6px; font-size: 12px; text-align: left; }
        .empty-btn { background: #f3f4f6; color: #4b5563; border: 1px dashed #d1d5db; padding: 6px; border-radius: 4px; cursor: pointer; width: 100%; font-size: 11px; }
        .empty-btn:hover { background: #e5e7eb; color: #111827; }
        
        /* 予約フォーム（モーダル） */
        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); justify-content: center; align-items: center; z-index: 10; }
        .modal-content { background: white; padding: 20px; border-radius: 8px; width: 300px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
        .form-group { margin-bottom: 12px; text-align: left; }
        .form-group label { display: block; font-size: 12px; font-weight: bold; margin-bottom: 4px; }
        .form-group input { width: 100%; padding: 8px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; }
        .btn-submit { background: #2563eb; color: white; border: none; padding: 10px; width: 100%; border-radius: 4px; cursor: pointer; font-weight: bold; margin-top: 8px; }
        .btn-cancel { background: #9ca3af; color: white; border: none; padding: 6px; width: 100%; border-radius: 4px; cursor: pointer; margin-top: 6px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>📅 予約状況カレンダー</h2>
        <p style="text-align: center; color: #6b7280; font-size: 13px; margin-bottom: 5px;">
          今日から2週間分の予約状況です（横スクロール可能 ↔）
        </p>
        
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th class="time-col">時間</th>
                ${dates.map(d => `<th>${d.label}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${timeSlots.map(time => `
                <tr>
                  <td class="time-col">${time}</td>
                  ${dates.map(d => {
                    const booking = reservations.find(r => r.date === d.formatted && r.time === time);
                    if (booking) {
                      return `<td>
                        <div class="booking-card">
                          <strong>${booking.name} 様</strong>
                          <div style="font-size: 10px; margin-top: 2px;">${booking.detail}</div>
                        </div>
                      </td>`;
                    } else {
                      return `<td>
                        <button class="empty-btn" onclick="openForm('${d.formatted}', '${time}')">＋ 予約</button>
                      </td>`;
                    }
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 予約フォームモーダル -->
      <div id="reservationModal" class="modal">
        <div class="modal-content">
          <h3 style="margin-top: 0;">新規予約の登録</h3>
          <form action="/reserve" method="POST">
            <input type="hidden" id="formDate" name="date">
            <input type="hidden" id="formTime" name="time">
            
            <div class="form-group">
              <label>日時</label>
              <div id="displayDateTime" style="font-weight: bold; color: #2563eb;"></div>
            </div>
            
            <div class="form-group">
              <label for="name">お名前</label>
              <input type="text" id="name" name="name" required placeholder="例：高橋 健太">
            </div>
            
            <div class="form-group">
              <label for="detail">内容・メモ</label>
              <input type="text" id="detail" name="detail" placeholder="例：練習・打ち合わせ">
            </div>
            
            <button type="submit" class="btn-submit">予約を確定する</button>
            <button type="button" class="btn-cancel" onclick="closeForm()">キャンセル</button>
          </form>
        </div>
      </div>

      <script>
        function openForm(date, time) {
          document.getElementById('formDate').value = date;
          document.getElementById('formTime').value = time;
          document.getElementById('displayDateTime').innerText = date + ' ' + time + '〜';
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

// 予約登録処理
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

export default app;