'use client';

import React, { useState, useEffect } from 'react';

export default function CalendarReservation() {
  // ① SSR（サーバーサイド描画）とクライアントの不一致を防ぐフラグ
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [reservations, setReservations] = useState([
    { id: 1, date: '2026-07-24', time: '10:00', name: '山田 太郎', detail: '初回相談' },
    { id: 2, date: '2026-07-25', time: '14:00', name: '佐藤 花子', detail: '打ち合わせ' },
    { id: 3, date: '2026-07-26', time: '11:00', name: '鈴木 一郎', detail: '面談' },
  ]);

  const timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
  const dates = ['2026-07-24', '2026-07-25', '2026-07-26'];

  // 読み込みが完了するまで画面表示を待つ
  if (!isMounted) {
    return null;
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', color: '#333' }}>📅 予約状況カレンダー</h2>
      
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #ddd', padding: '12px', background: '#f8f9fa', width: '80px' }}>
              時間
            </th>
            {dates.map(date => (
              <th key={date} style={{ border: '1px solid #ddd', padding: '12px', background: '#f8f9fa' }}>
                {date}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map(time => (
            <tr key={time}>
              <td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'center', fontWeight: 'bold', background: '#fafafa' }}>
                {time}
              </td>
              
              {dates.map(date => {
                const booking = reservations.find(r => r.date === date && r.time === time);
                
                return (
                  <td key={`${date}-${time}`} style={{ border: '1px solid #ddd', padding: '8px', height: '80px', verticalAlign: 'top', width: '30%' }}>
                    {booking ? (
                      <div style={{ background: '#dbeafe', color: '#1e3a8a', padding: '8px', borderRadius: '6px', fontSize: '14px', height: '100%', boxSizing: 'border-box' }}>
                        <strong>{booking.name} 様</strong>
                        <div style={{ fontSize: '12px', marginTop: '4px' }}>{booking.detail}</div>
                      </div>
                    ) : (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', cursor: 'pointer' }}
                           onClick={() => alert(`${date}の${time}に新規予約を入れますか？`)}>
                        空き
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}