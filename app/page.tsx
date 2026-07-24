'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabaseと接続するための設定
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 予約データの型（情報のセット）を定義
interface Reservation {
  id: number;
  studio_name: string;
  band_name: string;
  date: string;
  start_time: string;
  end_time: string;
  reserved_by: string;
}

export default function Home() {
  const [reservations, setReservations] = useState<Reservation[]>([]);

  // 画面が開いた瞬間に、Supabaseからデータを取ってくる処理
  useEffect(() => {
    async function fetchReservations() {
      const { data, error } = await supabase
        .from('reservations') // Supabaseで作ったテーブル名
        .select('*')          // 全ての項目を取得
        .order('date', { ascending: true }); // 日付が近い順に並べる

      if (data) {
        setReservations(data);
      }
      
      if (error) {
        // 🔍 ここでURLや鍵が正しく読み込めているか答え合わせをします
        alert(
          "【接続チェック】\n" +
          "設定されているURL: " + (supabaseUrl || "空っぽ（読み込めていません）") + "\n\n" +
          "設定されている鍵: " + (supabaseAnonKey ? (supabaseAnonKey.slice(0, 10) + "...") : "空っぽ（読み込めていません）") + "\n\n" +
          "エラーの理由: " + error.message
        );
        console.error('エラーの詳細:', error);
      }
    }

    fetchReservations();
  }, []);

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', backgroundColor: '#0a0a0a', color: '#fff', minHeight: '100vh' }}>
      <h1 style={{ color: '#bc84ee', borderBottom: '2px solid #bc84ee', paddingBottom: '10px', fontSize: '28px' }}>
        🎸 軽音部 スタジオ予約状況
      </h1>

      <div style={{ marginTop: '30px' }}>
        {reservations.length === 0 ? (
          <p style={{ color: '#aaa' }}>現在、予約データがありません。Supabaseからデータを追加してみてください。</p>
        ) : (
          <div style={{ display: 'grid', gap: '15px' }}>
            {reservations.map((res) => (
              <div key={res.id} style={{ background: '#161616', padding: '20px', borderRadius: '12px', border: '1px solid #262626' }}>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#dcfd8b', marginBottom: '5px' }}>
                  📍 {res.studio_name}
                </div>
                <div style={{ fontSize: '22px', fontWeight: 'bold', margin: '5px 0' }}>
                  {res.band_name} <span style={{ fontSize: '14px', color: '#888', fontWeight: 'normal' }}>（予約者: {res.reserved_by}）</span>
                </div>
                <div style={{ color: '#daffde', fontSize: '16px', marginTop: '10px' }}>
                  📅 {res.date} │ ⏰ {res.start_time.slice(0, 5)} ～ {res.end_time.slice(0, 5)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}