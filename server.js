import express from 'express';
import { createClient } from '@supabase/supabase-js';

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- Supabaseクライアントの初期化 ---
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ [警告] SUPABASE_URL または SUPABASE_KEY が設定されていません。');
}

const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder'
);

// 時間 ('HH:MM') を 分(数字) に変換するヘルパー
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// 30分刻みの時間リストを生成
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
app.get('/', async (req, res) => {
  // スマホのブラウザキャッシュによる古い画面表示を防止
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const timeSlots = generateTimeSlots();
  let currentReservations = [];

  // Supabaseから全予約データを取得
  try {
    if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
      const { data: reservations, error } = await supabase
        .from('reservations')
        .select('*');

      if (error) {
        console.error('予約データの取得エラー:', error.message);
      } else {
        currentReservations = reservations || [];
      }
    }
  } catch (err) {
    console.error('データベース接続例外:', err);
  }

  // 31日間分の日付リストを動的生成
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

  const HOUR_HEIGHT = 60;
  const TOTAL_HEIGHT = 24 * HOUR_HEIGHT;
  const DAY_WIDTH = 160;

  const html = `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <title>スタジオ予約表</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 10px; background: #f8fafc; margin: 0; color: #1e293b; }
        .container { max-width: 100%; margin: 0 auto; background: white; padding: 12px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        h2 { text-align: center; color: #0f172a; margin-top: 4px; margin-bottom: 12px; font-size: 20px; font-weight: 700; }

        .header-actions { text-align: center; margin-bottom: 12px; }
        .btn-custom-add { background: #2563eb; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 15px; width: 100%; max-width: 320px; box-shadow: 0 2px 4px rgba(37,99,235,0.25); }
        .btn-custom-add:active { background: #1d4ed8; }

        .gcal-wrapper { overflow: auto; max-height: 80vh; -webkit-overflow-scrolling: touch; border: 1px solid #cbd5e1; border-radius: 8px; position: relative; background: white; }
        .gcal-header { display: flex; position: sticky; top: 0; z-index: 20; background: #f8fafc; border-bottom: 1px solid #cbd5e1; min-width: max-content; }
        .gcal-time-header { width: 65px; min-width: 65px; background: #f8fafc; border-right: 1px solid #cbd5e1; position: sticky; left: 0; z-index: 30; }
        .gcal-days-header { display: flex; }
        .gcal-day-col-header { width: ${DAY_WIDTH}px; min-width: ${DAY_WIDTH}px; text-align: center; padding: 10px 0; border-right: 1px solid #e2e8f0; background: #f8fafc; }
        .gcal-day-col-header.today { background: #eff6ff; }

        .date-num { font-size: 18px; font-weight: 800; line-height: 1.1; color: #0f172a; }
        .day-name { font-size: 13px; font-weight: 600; color: #64748b; margin-top: 2px; }
        .sat .date-num, .sat .day-name { color: #2563eb; }
        .sun .date-num, .sun .day-name { color: #dc2626; }
        .today-badge { display: inline-block; background: #2563eb; color: white; font-size: 10px; padding: 1px 6px; border-radius: 4px; font-weight: 700; margin-bottom: 2px; }

        .gcal-body { display: flex; position: relative; height: ${TOTAL_HEIGHT}px; min-width: max-content; }
        .gcal-time-col { width: 65px; min-width: 65px; position: sticky; left: 0; z-index: 15; background: #f8fafc; border-right: 1px solid #cbd5e1; height: 100%; box-shadow: 2px 0 5px rgba(0,0,0,0.03); }
        .gcal-time-slot { height: ${HOUR_HEIGHT}px; border-bottom: 1px solid #e2e8f0; text-align: center; font-size: 12px; font-weight: 700; color: #64748b; padding-top: 4px; box-sizing: border-box; }

        .gcal-day-col { width: ${DAY_WIDTH}px; min-width: ${DAY_WIDTH}px; position: relative; border-right: 1px solid #e2e8f0; height: 100%; background-image: linear-gradient(to bottom, #f1f5f9 1px, transparent 1px); background-size: 100% ${HOUR_HEIGHT / 2}px; }
        .gcal-day-col.today { background-color: rgba(239, 246, 255, 0.4); }

        .click-slot { position: absolute; left: 0; width: 100%; height: 30px; cursor: pointer; }
        .click-slot:hover { background-color: rgba(37, 99, 235, 0.08); }

        .event-card {
          position: absolute;
          left: 4px;
          right: 4px;
          background: #3b82f6;
          color: white;
          border-radius: 6px;
          padding: 6px 8px;
          font-size: 13px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.15);
          border-left: 4px solid #1d4ed8;
          overflow: hidden;
          z-index: 10;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
        }
        .event-title { font-weight: 800; font-size: 14px; line-height: 1.2; word-break: break-all; margin-right: 18px; }
        .event-time { font-size: 12px; font-weight: 600; opacity: 0.95; margin-top: 3px; }
        .event-detail { font-size: 11px; opacity: 0.85; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .delete-btn { position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.15); color: white; border: none; border-radius: 4px; width: 22px; height: 22px; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; line-height: 1; }
        .delete-btn:active { background: #ef4444; }

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

        <div class="gcal-wrapper">
          <div class="gcal-header">
            <div class="gcal-time-header"></div>
            <div class="gcal-days-header">
              ${dates.map(d => {
                let dayClass = '';
                if (d.dayOfWeekNum === 6) dayClass = 'sat';
                if (d.dayOfWeekNum === 0) dayClass = 'sun';

                return `
                  <div class="gcal-day-col-header ${d.isToday ? 'today' : ''} ${dayClass}">
                    ${d.isToday ? '<div><span class="today-badge">今日</span></div>' : ''}
                    <div class="date-num">${d.monthDate}</div>
                    <div class="day-name">(${d.dayOfWeek})</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <div class="gcal-body">
            <div class="gcal-time-col">
              ${Array.from({length: 24}).map((_, h) => `
                <div class="gcal-time-slot">${String(h).padStart(2, '0')}:00</div>
              `).join('')}
            </div>

            ${dates.map(d => {
              const dayBookings = currentReservations.filter(r => r.date === d.formatted);

              return `
                <div class="gcal-day-col ${d.isToday ? 'today' : ''}">
                  ${timeSlots.map(t => {
                    const min = timeToMinutes(t);
                    return `<div class="click-slot" style="top: ${min}px;" onclick="openForm('${d.formatted}', '${t}')"></div>`;
                  }).join('')}

                  ${dayBookings.map(b => {
                    const startMin = timeToMinutes(b.start_time);
                    const endMin = b.end_time === '24:00' ? 24 * 60 : timeToMinutes(b.end_time);
                    const height = endMin - startMin;

                    return `
                      <div class="event-card" style="top: ${startMin}px; height: ${height - 2}px;" onclick="event.stopPropagation();">
                        <form action="/delete-reserve" method="POST" style="display:inline;" onsubmit="return confirm('${b.name}の予約（${b.start_time}〜${b.end_time}）を削除しますか？');">
                          <input type="hidden" name="id" value="${b.id}">
                          <button type="submit" class="delete-btn" title="削除">×</button>
                        </form>
                        <div class="event-title">${b.name}</div>
                        <div class="event-time">${b.start_time} - ${b.end_time}</div>
                        ${b.detail ? `<div class="event-detail">${b.detail}</div>` : ''}
                      </div>
                    `;
                  }).join('')}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

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
          if (!t) return 0;
          const [h, m] = t.split(':').map(Number);
          return h * 60 + m;
        }

        window.addEventListener('DOMContentLoaded', () => {
          const wrapper = document.querySelector('.gcal-wrapper');
          if (wrapper) {
            wrapper.scrollTop = 8 * 60;
          }
        });
      </script>
    </body>
    </html>
  `;

  res.send(html);
});

// 予約追加処理
app.post('/reserve', async (req, res) => {
  const { date, startTime, endTime, name, detail } = req.body;

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    return res.send(`
      <script>
        alert('エラー: Vercelの環境変数 (SUPABASE_URL / SUPABASE_KEY) が設定されていません。');
        window.location.href = '/';
      </script>
    `);
  }

  if (date && startTime && endTime && name) {
    try {
      const newStart = timeToMinutes(startTime);
      const newEnd = endTime === '24:00' ? 24 * 60 : timeToMinutes(endTime);

      // 重複チェック
      const { data: existingReservations, error: fetchErr } = await supabase
        .from('reservations')
        .select('*')
        .eq('date', date);

      if (fetchErr) {
        return res.send(`
          <script>
            alert('データ読み込みエラー: ${fetchErr.message}');
            window.location.href = '/';
          </script>
        `);
      }

      const isOverlap = (existingReservations || []).some(r => {
        const rStart = timeToMinutes(r.start_time);
        const rEnd = r.end_time === '24:00' ? 24 * 60 : timeToMinutes(r.end_time);

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

      // Supabaseにインサート
      const { error: insertErr } = await supabase.from('reservations').insert([
        {
          date,
          start_time: startTime,
          end_time: endTime,
          name,
          detail: detail || ''
        }
      ]);

      if (insertErr) {
        return res.send(`
          <script>
            alert('保存エラー (Supabase): ${insertErr.message}');
            window.location.href = '/';
          </script>
        `);
      }

    } catch (err) {
      return res.send(`
        <script>
          alert('サーバー例外エラー: ${err.message}');
          window.location.href = '/';
        </script>
      `);
    }
  }

  // キャッシュを回避してリダイレクト（HTTP 303）
  res.redirect(303, '/');
});

// 予約削除処理
app.post('/delete-reserve', async (req, res) => {
  const { id } = req.body;

  if (id) {
    try {
      await supabase
        .from('reservations')
        .delete()
        .eq('id', id);
    } catch (err) {
      console.error('予約削除エラー:', err);
    }
  }

  res.redirect(303, '/');
});

export default app;