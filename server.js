import express from 'express';
import React from 'react';
import { renderToString } from 'react-dom/server';

const app = express();

// 予約データの初期値
let reservations = [
  { id: 1, date: '2026-07-24', time: '10:00', name: '山田 太郎', detail: '初回相談' },
  { id: 2, date: '2026-07-25', time: '14:00', name: '佐藤 花子', detail: '打ち合わせ' },
  { id: 3, date: '2026-07-26', time: '11:00', name: '鈴木 一郎', detail: '面談' },
];

// メインのカレンダーページを表示するルート
app.get('/', (req, res) => {
  const timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
  const dates = ['2026-07-24', '2026-07-25', '2026-07-26'];

  // サーバーサイドでHTMLを組み立てる
  const html = `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>予約状況カレンダー</title>
      <style>
        body { font-family: sans-serif; padding: 20px; background: #f9fafb; margin: 0; }
        .container { max-width: 1000px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.05); }
        h2 { text-align: center; color: #333; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #e5e7eb; padding: 12px; text-align: center; }
        th { background: #f3f4f6; }
        .time-col { background: #f9fafb; font-weight: bold; width: 80px; }
        .booking-card { background: #dbeafe; color: #1e3a8a; padding: 8px; border-radius: 6px; font-size: 14px; text-align: left; }
        .empty-slot { color: #9ca3af; cursor: pointer; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>📅 予約状況カレンダー</h2>
        <table>
          <thead>
            <tr>
              <th>時間</th>
              ${dates.map(date => `<th>${date}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${timeSlots.map(time => `
              <tr>
                <td class="time-col">${time}</td>
                ${dates.map(date => {
                  const booking = reservations.find(r => r.date === date && r.time === time);
                  if (booking) {
                    return `<td>
                      <div class="booking-card">
                        <strong>${booking.name} 様</strong>
                        <div style="font-size: 12px; margin-top: 4px;">${booking.detail}</div>
                      </div>
                    </td>`;
                  } else {
                    return `<td><span class="empty-slot">空き</span></td>`;
                  }
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </body>
    </html>
  `;

  res.send(html);
});

// Vercelでサーバーレス関数として動かすために必須のエクスポート
export default app;