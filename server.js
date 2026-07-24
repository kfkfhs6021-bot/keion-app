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
  const timeSlots = generateTimeSlots();
  
  // 今日から1ヶ月分（31日間）の日付リストを自動生成
  const dates = [];
  const today = new Date();

  for (let i = 0; i < 31; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const date = String(d.getDate()).padStart(2, '0');
    const dayOfWeekNum = d.getDay();
    const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][dayOfWeekNum];
    
    dates.push({
      formatted: `${year}-${month}-${date}`,
      monthDate: `${Number(month)}/${Number(date)}`,
      dayOfWeek,
      dayOfWeekNum,
      isToday: i === 0
    });
  }

  const html = `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <title>スタジオ予約表</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; padding: 10px; background: #f8fafc; margin: 0; }
        .container { max-width: 1400px; margin: 0 auto; background: white; padding: 12px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        h2 { text-align: center; color: #0f172a; margin-top: 4px; margin-bottom: 12px; font-size: 20px; font-weight: 700; }
        
        .header-actions { text-align: center; margin-bottom: 12px; }
        .btn-custom-add { background: #2563eb; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 15px; width: 100%; max-width: 320px; box-shadow: 0 2px 4px rgba(37,99,235,0.2); }
        .btn-custom-add:active { background: #1d4ed8; }

        /* スクロール枠 */
        .table-wrapper { overflow-x: auto; max-height: 78vh; overflow-y: auto; -webkit-overflow-scrolling: touch; border: 1px solid #cbd5e1; border-radius: 6px; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th, td { border: 1px solid #e2e8f0; padding: 0; text-align: center; vertical-align: top; }
        
        /* スマホで見やすいよう列幅と高さを拡大 */
        th { background: #f8fafc; height: 52px; vertical-align: middle; position: sticky; top: 0; z-index: 10; min-width: 110px; font-weight: normal; }
        th.today-header { background: #eff6ff; }
        
        .date-display { font-size: 16px; font-weight: 700; color: #1e293b; line-height: 1.1; }
        .day-display { font-size: 12px; margin-top: 3px; color: #64748b; font-weight: 600; }
        
        /* 土日カラー */
        .sat .date-display, .sat .day-display { color: #2563eb; }
        .sun .date-display, .sun .day-display { color: #dc2626; }
        
        .today-badge { display: inline-block; background: #2563eb; color: white; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-bottom: 2px; }

        /* 時間固定列（文字サイズと固定位置を最適化） */
        .time-col { background: #f8fafc; font-weight: 700; width: 68px; min-width: 68px; position: sticky; left: 0; z-index: 11; font-size: 12px; color: #334155; height: 40px; line-height: 40px; border-right: 2px solid #94a3b8; }
        
        .hour-row { border-top: 2px solid #cbd5e1; }
        
        .grid-cell { cursor: pointer; height: 40px; transition: background-color 0.12s; }
        .grid-cell:active { background-color: #e2e8f0; }
        
        /* 予約カード（スマホで見やすいフォント＆サイズ調整） */
        .booking-card { 
          background: #2563eb; 
          color: white; 
          padding: 6px 8px; 
          border-radius: 6px; 
          text-align: left; 
          position: relative; 
          box-shadow: 0 1px 3px rgba(0,0,0,0.15); 
          height: 100%; 
          box-sizing: border-box;
          z-index: 5;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          overflow: hidden;
        }
        .booking-name { font-weight: 700; font-size: 13px; line-height: 1.2; margin-right: 20px; word-break: break-all; }
        .booking-time { font-size: 12px; opacity: 0.95; margin-top: 4px; font-weight: 600; }
        .booking-detail { font-size: 11px; opacity: 0.85; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        
        .delete-btn { position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.15); color: white; border: none; border-radius: 4px; width: 22px; height: 22px; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; line-height: 1; }
        .delete-btn:active { background: #ef4444; }
        
        /* スマホ向けモーダル */
        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); justify-content: center; align-items: center; z-index: 100; padding: 15px; }
        .modal-content { background: white; padding: 20px; border-radius: 12px; width: 100%; max-width: 360px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
        .form-group { margin-bottom: 14px; text-align: left; }
        .form-group label { display: block; font-size: 13px; font-weight: 700; margin-bottom: 6px; color: #1e293b; }
        .form-group input, .form-group select { width: 100%; padding: 10px; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 15px; background: white; }
        .time-range-group { display: flex; align-items: center; gap: 8px; }
        .btn-submit { background: #2563eb; color: white; border: none; padding: 12px; width: 100%; border-radius: 6px; cursor: pointer; font-weight: 700; margin-top: 8px; font-size: 15px; }
        .btn-cancel { background: #94a3b8; color: white; border: none; padding: 8px; width: 100%; border-radius: 6px; cursor: pointer; margin-top: 8px; font-size: 13px; }
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
                <th class="time-col" style="z-index: 12;">時間</th>
                ${dates.map(d => {
                  let dayClass = '';
                  if (d.dayOfWeekNum === 6) dayClass = 'sat';
                  if (d.dayOfWeekNum === 0) dayClass = 'sun';

                  return `
                    <th class="${d.isToday ? 'today-header' : ''} ${dayClass}">
                      ${d.isToday ? '<div><span class="today-badge">今日</span></div>' : ''}
                      <div class="date-display">${d.monthDate}</div>
                      <div class="day-display">(${d.dayOfWeek})</div>
                    </th>
                  `;
                }).join('')}
              </tr>
            </thead>
            <tbody>
              ${(() => {
                const skipCells = {};
                dates.forEach(d => { skipCells[d.formatted] = 0; });

                return timeSlots.map(time => {
                  const isHour = time.endsWith(':00');

                  return `
                    <tr class="${isHour ? 'hour-row' : ''}">
                      <td class="time-col">${time}</td>
                      ${dates.map(d => {
                        if (skipCells[d.formatted] > 0) {
                          skipCells[d.formatted]--;
                          return ''; 
                        }

                        const booking = reservations.find(r => r.date === d.formatted && r.startTime === time);

                        if (booking) {
                          const startMin = timeToMinutes(booking.startTime);
                          const endMin = timeToMinutes(booking.endTime);
                          const durationMin = endMin - startMin;
                          const rowSpan = Math.max(1, Math.ceil(durationMin / 30));

                          skipCells[d.formatted] = rowSpan - 1;

                          return `
                            <td rowspan="${rowSpan}" style="padding: 2px;">
                              <div class="booking-card" onclick="event.stopPropagation();">
                                <form action="/delete-reserve" method="POST" style="display:inline;" onsubmit="return confirm('${booking.name}の予約（${booking.startTime}〜${booking.endTime}）を削除しますか？');">
                                  <input type="hidden" name="id" value="${booking.id}">
                                  <button type="submit" class="delete-btn" title="削除">×</button>
                                </form>
                                <div class="booking-name">${booking.name}</div>
                                <div class="booking-time">${booking.startTime} - ${booking.endTime}</div>
                                ${booking.detail ? `<div class="booking-detail">${booking.detail}</div>` : ''}
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
          <h3 style="margin-top: 0; font-size: 16px; color: #0f172a;">新規予約</h3>
          <form action="/reserve" method="POST" onsubmit="return validateTimes();">
            <div class="form-group">
              <label for="formDate">日付</label>
              <input type="date" id="formDate" name="date" required>
            </div>

            <div class="form-group">
              <label>時間</label>
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
              <label for="name">名前</label>
              <input type="text" id="name" name="name" required placeholder="例：高橋 健太">
            </div>
            
            <div class="form-group">
              <label for="detail">メモ</label>
              <input type="text" id="detail" name="detail" placeholder="例：Aスタジオ / ドラム練習">
            </div>
            
            <button type="submit" class="btn-submit">予約する</button>
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

    const isOverlap = reservations.some(r => {
      if (r.date !== date) return false;
      const rStart = timeToMinutes(r.startTime);
      const rEnd = r.endTime === '24:00' ? 24 * 60 : timeToMinutes(r.endTime);

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