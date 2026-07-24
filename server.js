import express from 'express';

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 予約データ（初期サンプルデータ）
let reservations = [
  { id: 1, date: '2026-07-24', startTime: '10:30', endTime: '12:30', name: '山田 太郎', detail: 'バンド練習' },
  { id: 2, date: '2026-07-25', startTime: '14:00', endTime: '16:00', name: '佐藤 花子', detail: '個人練習' },
];

// 時間文字列 ('HH:MM') を 分(数字) に変換するヘルパー
function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// 00:00 〜 23:30 までの30分刻みの時間リストを生成するヘルパー
function generateTimeSlots() {
  const slots = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      slots.push(timeStr);
    }
  }
  return slots;
}

// メインページ（カレンダー表示）
app.get('/', (req, res) => {
  const timeSlots = generateTimeSlots(); // 30分単位（全48コマ）
  
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

        .table-wrapper { overflow-x: auto; max-height: 75vh; overflow-y: auto; -webkit-overflow-scrolling: touch; border: 1px solid #e5e7eb; border-radius: 6px; }
        table { width: 100%; min-width: 1000px; border-collapse: collapse; table-layout: fixed; }
        th, td { border: 1px solid #e5e7eb; padding: 0; text-align: center; vertical-align: top; }
        th { background: #f3f4f6; font-size: 13px; height: 36px; vertical-align: middle; position: sticky; top: 0; z-index: 10; }
        
        .time-col { background: #f9fafb; font-weight: bold; width: 65px; position: sticky; left: 0; z-index: 11; font-size: 11px; color: #4b5563; height: 32px; line-height: 32px; border-right: 2px solid #d1d5db; }
        
        /* 正時（00分）の行を目立たせる */
        .hour-row { border-top: 2px solid #cbd5e1; }
        
        /* 空きマス */
        .grid-cell { cursor: pointer; height: 32px; transition: background-color 0.15s; }
        .grid-cell:hover { background-color: #eff6ff; }
        
        /* 時間を跨ぐ予約カード */
        .booking-card { 
          background: #3b82f6; 
          color: white; 
          padding: 6px 8px; 
          border-radius: 6px; 
          font-size: 12px; 
          text-align: left; 
          position: relative; 
          box-shadow: 0 2px 4px rgba(0,0,0,0.15); 
          height: 100%; 
          box-sizing: border-box;
          z-index: 5;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
        }
        .booking-card strong { display: block; font-size: 13px; line-height: 1.2; margin-right: 18px; }
        .booking-time { font-size: 11px; opacity: 0.9; margin-top: 2px; font-weight: bold; }
        .booking-detail { font-size: 11px; opacity: 0.85; margin-top: 2px; }
        
        .delete-btn { position: absolute; top: 4px; right: 4px; background: rgba(255,255,255,0.3); color: white; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; line-height: 1; transition: background 0.2s; }
        .delete-btn:hover { background: #ef4444; }
        
        /* モーダル */
        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); justify-content: center; align-items: center; z-index: 100; }
        .modal-content { background: white; padding: 24px; border-radius: 8px; width: 320px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
        .form-group { margin-bottom: 14px; text-align: left; }
        .form-group label { display: block; font-size: 12px; font-weight: bold; margin-bottom: 4px; color: #374151; }
        .form-group input, .form-group select { width: 100%; padding: 8px; box-sizing: border-box; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px; background: white; }
        .time-range-group { display: flex; align-items: center; gap: 8px; }
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
                <th class="time-col">時間</th>
                ${dates.map(d => `<th>${d.label}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${(() => {
                // セルの描画スキップ（rowspan対応）用フラグ
                const skipCells = {};
                dates.forEach(d => { skipCells[d.formatted] = 0; });

                return timeSlots.map(time => {
                  const currentMin = timeToMinutes(time);
                  const isHour = time.endsWith(':00');

                  return `
                    <tr class="${isHour ? 'hour-row' : ''}">
                      <td class="time-col">${time}</td>
                      ${dates.map(d => {
                        // 他のコマからのrowspan展開によりスキップすべきセル
                        if (skipCells[d.formatted] > 0) {
                          skipCells[d.formatted]--;
                          return ''; 
                        }

                        // この開始時間にぴったり始まる予約を検索
                        const booking = reservations.find(r => r.date === d.formatted && r.startTime === time);

                        if (booking) {
                          const startMin = timeToMinutes(booking.startTime);
                          const endMin = timeToMinutes(booking.endTime);
                          const durationMin = endMin - startMin;
                          // 30分 = 1コマの行数 (rowspan)
                          const rowSpan = Math.max(1, Math.ceil(durationMin / 30));

                          // スキップカウントをセット
                          skipCells[d.formatted] = rowSpan - 1;

                          return `
                            <td rowspan="${rowSpan}" style="padding: 2px;">
                              <div class="booking-card" onclick="event.stopPropagation();">
                                <form action="/delete-reserve" method="POST" style="display:inline;" onsubmit="return confirm('${booking.name}様の予約（${booking.startTime}〜${booking.endTime}）を削除しますか？');">
                                  <input type="hidden" name="id" value="${booking.id}">
                                  <button type="submit" class="delete-btn" title="予約を削除">×</button>
                                </form>
                                <div>
                                  <strong>${booking.name} 様</strong>
                                  <div class="booking-time">⏰ ${booking.startTime} 〜 ${booking.endTime}</div>
                                </div>
                                ${booking.detail ? `<div class="booking-detail">📝 ${booking.detail}</div>` : ''}
                              </div>
                            </td>
                          `;
                        } else {
                          return `
                            <td class="grid-cell" onclick="openForm('${d.formatted}', '${time}')"></td>
                          `;
                        }
                      }).join('')}
                    </tr>
                  `;
                }).join('');
              })()}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 予約登録モーダル -->
      <div id="reservationModal" class="modal">
        <div class="modal-content">
          <h3 style="margin-top: 0; font-size: 16px; color: #111827;">新規予約の登録</h3>
          <form action="/reserve" method="POST" onsubmit="return validateTimes();">
            <div class="form-group">
              <label for="formDate">日付</label>
              <input type="date" id="formDate" name="date" required>
            </div>

            <div class="form-group">
              <label>予約時間（30分単位）</label>
              <div class="time-range-group">
                <select id="startTime" name="startTime" required onchange="adjustEndTime()">
                  ${timeSlots.map(t => `<option value="${t}">${t}</option>`).join('')}
                </select>
                <span>〜</span>
                <select id="endTime" name="endTime" required>
                  ${timeSlots.map(t => `<option value="${t}">${t}</option>`).join('')}
                  <option value="24:00">24:00</option>
                </select>
              </div>
            </div>
            
            <div class="form-group">
              <label for="name">お名前</label>
              <input type="text" id="name" name="name" required placeholder="例：高橋 健太">
            </div>
            
            <div class="form-group">
              <label for="detail">内容・メモ</label>
              <input type="text" id="detail" name="detail" placeholder="例：Aスタジオ / ドラム練習">
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
            document.getElementById('startTime').value = time;
            adjustEndTime();
          } else {
            document.getElementById('startTime').value = "10:00";
            adjustEndTime();
          }

          document.getElementById('reservationModal').style.display = 'flex';
        }

        function closeForm() {
          document.getElementById('reservationModal').style.display = 'none';
        }

        // 開始時間を選択したら、自動で1時間後を終了時間にセット
        function adjustEndTime() {
          const start = document.getElementById('startTime').value;
          const [h, m] = start.split(':').map(Number);
          
          let endH = h + 1;
          let endM = m;
          
          let endStr = String(endH).padStart(2, '0') + ':' + String(endM).padStart(2, '0');
          if (endH >= 24) endStr = '24:00';

          const endTimeSelect = document.getElementById('endTime');
          if ([...endTimeSelect.options].some(opt => opt.value === endStr)) {
            endTimeSelect.value = endStr;
          }
        }

        // 時間の整合性チェック
        function validateTimes() {
          const start = document.getElementById('startTime').value;
          const end = document.getElementById('endTime').value;

          const startMin = timeToMinutes(start);
          const endMin = end === '24:00' ? 24 * 60 : timeToMinutes(end);

          if (endMin <= startMin) {
            alert('終了時間は開始時間よりも後の時間を選択してください。');
            return false;
          }
          return true;
        }

        function timeToMinutes(t) {
          const [h, m] = t.split(':').map(Number);
          return h * 60 + m;
        }
      </script>
    </body>
    </html>
  `;

  res.send(html);
});

// 予約追加処理
app.post('/reserve', (req, res) => {
  const { date, startTime, endTime, name, detail } = req.body;

  if (date && startTime && endTime && name) {
    const newStart = timeToMinutes(startTime);
    const newEnd = endTime === '24:00' ? 24 * 60 : timeToMinutes(endTime);

    // 時間重複チェック
    const isOverlap = reservations.some(r => {
      if (r.date !== date) return false;
      const rStart = timeToMinutes(r.startTime);
      const rEnd = r.endTime === '24:00' ? 24 * 60 : timeToMinutes(r.endTime);

      // 時間帯が重なっているか評価
      return Math.max(newStart, rStart) < Math.min(newEnd, rEnd);
    });

    if (isOverlap) {
      return res.send(`
        <script>
          alert('指定された時間帯には既に別の予約が入っています。時間を変更してください。');
          window.location.href = '/';
        </script>
      `);
    }

    reservations.push({
      id: Date.now(),
      date,
      startTime,
      endTime,
      name,
      detail: detail || ''
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