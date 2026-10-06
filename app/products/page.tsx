'use client';

import React, { useEffect, useState, CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/auth';

interface ProductItem {
  id?: string;
  title?: string;
  description?: string;
  category?: string;
  link?: string;
  status?: string;
  imageurl?: string;
  [key: string]: any;
}

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // State untuk melacak ID produk mana yang sedang dibuka detailnya
  const [expandedProductIds, setExpandedProductIds] = useState<Record<string, boolean>>({});

  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [activeWaitlistProductId, setActiveWaitlistProductId] = useState<string | null>(null);
  const [submittingWaitlist, setSubmittingWaitlist] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const session = getSession();
    const hasValidUser = Boolean(
      session && 
      typeof session === 'object' && 
      (session.email || session.id || session.user_id || session.userid)
    );
    setIsLoggedIn(hasValidUser);

    const fetchProducts = async () => {
      try {
        setLoading(true);
        // 🟢 Mengambil data produk langsung dari endpoint MySQL Hostinger via Prisma
        const res = await fetch(`/api/products?_t=${Date.now()}`, { 
          cache: 'no-store'
        });
        
        const json = await res.json();

        let rawList: any[] = [];
        if (json && json.success && Array.isArray(json.data)) {
          rawList = json.data;
        } else if (Array.isArray(json)) {
          rawList = json;
        }

        if (rawList.length > 0) {
          const formattedProducts = rawList.map((item: any) => ({
            id: item.id || item.ID_Produk || item.idproduk || '',
            title: item.nama || item.Nama_Produk || item.title || 'Tools Riset',
            description: item.deskripsi || item.Deskripsi || item.description || '',
            category: item.kategori || item.Kategori || item.category || 'Umum',
            link: item.link || item.Link || '',
            status: item.status || item.Status || 'Tersedia',
            imageurl: item.imageurl || item.Image_URL || item.gambar || ''
          }));
          setProducts(formattedProducts);
        } else {
          setProducts([]);
        }
      } catch (err) {
        console.error('Gagal memuat produk dari database MySQL:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const toggleDetail = (productId: string) => {
    setExpandedProductIds(prev => ({
      ...prev,
      [productId]: !prev[productId]
    }));
  };

  const handleWaitlistSubmit = async (e: React.FormEvent, productId: string, productTitle: string) => {
    e.preventDefault();
    if (!waitlistEmail || !waitlistEmail.includes('@')) {
      alert('Masukkan alamat email yang valid.');
      return;
    }

    try {
      setSubmittingWaitlist(true);
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'admin@avitech.cloud',
          subject: `Pendaftaran Waitlist Produk: ${productTitle}`,
          textBody: `Pengguna (${waitlistEmail}) telah mendaftar waitlist untuk produk #${productId} - ${productTitle}.`
        })
      }).catch(() => null);

      alert(`Terima kasih! Email ${waitlistEmail} telah dicatat dalam daftar tunggu untuk produk "${productTitle}".`);
      setWaitlistEmail('');
      setActiveWaitlistProductId(null);
    } catch (err) {
      console.error('Gagal mencatat waitlist:', err);
      setWaitlistEmail('');
      setActiveWaitlistProductId(null);
    } finally {
      setSubmittingWaitlist(false);
    }
  };

  return (
    <div style={STYLES.page}>
      <div style={STYLES.container}>
        <div style={STYLES.headerRow}>
          <div>
            <h1 style={STYLES.pageTitle}>Produk &amp; Tools Riset Pilihan</h1>
            <p style={STYLES.pageDesc}>
              Jelajahi berbagai perangkat, software, dan modul analitik untuk mendukung riset Anda.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" onClick={() => router.push('/')} style={STYLES.btnSecondary}>
              ← Beranda
            </button>
            
            {isMounted && (
              isLoggedIn ? (
                <button type="button" onClick={() => router.push('/dashboard')} style={STYLES.btnPrimaryAction}>
                  🚀 Dashboard
                </button>
              ) : (
                <button type="button" onClick={() => router.push('/login')} style={STYLES.btnPrimaryAction}>
                  🔑 Masuk
                </button>
              )
            )}
          </div>
        </div>

        <div style={STYLES.noticeBox}>
          <span style={STYLES.noticeTitle}>🎯 Info:</span>
          <span style={STYLES.noticeText}>
            Tools riset di bawah ini dikurasi langsung dari database sistem untuk membantu analisis metodologi Anda. Klik tombol <strong>Lihat Detail</strong> untuk membaca gambaran lengkap perangkat.
          </span>
        </div>

        {loading ? (
          <div style={STYLES.loader}>Memuat Daftar Produk dari Database...</div>
        ) : products.length === 0 ? (
          <div style={STYLES.emptyBox}>Belum ada produk atau tools promosi yang tersedia saat ini.</div>
        ) : (
          <div style={STYLES.grid}>
            {products.map((prod, idx) => {
              const productId = prod.id || String(idx);
              const isAvailable = (prod.status || '').toLowerCase() === 'tersedia';
              const hasMainLink = Boolean(prod.link && prod.link.trim() !== '' && isAvailable);
              const isShowingForm = activeWaitlistProductId === productId;
              const hasImage = Boolean(prod.imageurl && prod.imageurl.trim() !== '');
              const isExpanded = Boolean(expandedProductIds[productId]);

              return (
                <div key={productId} style={STYLES.card}>
                  {/* GAMBAR BACKGROUND TERANG PROPORSIONAL */}
                  {hasImage && (
                    <div 
                      style={{
                        ...STYLES.bgImage,
                        backgroundImage: `url("${prod.imageurl}")`,
                      }}
                    />
                  )}

                  {/* KONTEN KARTU */}
                  <div style={{
                    ...STYLES.cardContent,
                    background: hasImage 
                      ? 'linear-gradient(180deg, rgba(15, 23, 42, 0.05) 0%, rgba(15, 23, 42, 0.25) 100%)' 
                      : '#ffffff'
                  }}>
                    {/* KOTAK KETIKAN GLASSMORPHISM */}
                    <div style={{
                      ...STYLES.textBlock,
                      background: hasImage ? 'rgba(255, 255, 255, 0.95)' : 'transparent',
                      backdropFilter: hasImage ? 'blur(4px)' : 'none',
                      border: hasImage ? '1px solid rgba(255, 255, 255, 0.6)' : 'none',
                      padding: hasImage ? '8px 10px' : '0',
                      borderRadius: '6px'
                    }}>
                      <div style={STYLES.cardHeader}>
                        <h3 style={STYLES.productTitle}>
                          {prod.title}
                        </h3>
                        <span style={STYLES.badge}>
                          {prod.category}
                        </span>
                      </div>

                      {/* 🟢 AREA DESKRIPSI DENGAN TOGGLE BACA LEBIH / TUTUP */}
                      {prod.description ? (
                        <div style={{ marginTop: 4 }}>
                          <p style={{
                            ...STYLES.productDesc,
                            display: isExpanded ? 'block' : '-webkit-box',
                            WebkitLineClamp: isExpanded ? 'unset' : 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: isExpanded ? 'visible' : 'hidden',
                          }}>
                            {prod.description}
                          </p>
                          <button
                            type="button"
                            onClick={() => toggleDetail(productId)}
                            style={STYLES.btnToggleDetail}
                          >
                            {isExpanded ? '▲ Tutup Deskripsi' : '▼ Lihat Detail...'}
                          </button>
                        </div>
                      ) : (
                        <p style={{ ...STYLES.productDesc, fontStyle: 'italic', color: '#94a3b8' }}>
                          Tidak ada deskripsi tambahan.
                        </p>
                      )}
                    </div>
                    
                    <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                      {hasMainLink ? (
                        <a 
                          href={prod.link} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          style={{
                            ...STYLES.btnLink,
                            background: hasImage ? 'rgba(255, 255, 255, 0.95)' : 'transparent',
                            padding: hasImage ? '5px 10px' : '0',
                            borderRadius: hasImage ? '5px' : '0',
                            border: hasImage ? '1px solid #cbd5e1' : 'none'
                          }}
                        >
                          Akses Perangkat →
                        </a>
                      ) : (
                        <div>
                          {!isShowingForm ? (
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <button type="button" disabled style={STYLES.btnComingSoon}>
                                ⏳ {prod.status || 'Segera Hadir'}
                              </button>
                              <button 
                                type="button" 
                                onClick={() => setActiveWaitlistProductId(productId)} 
                                style={STYLES.btnNotifyMe}
                              >
                                🔔 Waitlist
                              </button>
                            </div>
                          ) : (
                            <form onSubmit={(e) => handleWaitlistSubmit(e, productId, prod.title || 'Tools')} style={STYLES.waitlistForm}>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <input 
                                  type="email" 
                                  placeholder="Email..." 
                                  value={waitlistEmail}
                                  onChange={(e) => setWaitlistEmail(e.target.value)}
                                  style={STYLES.waitlistInput}
                                  required
                                />
                                <button type="submit" disabled={submittingWaitlist} style={STYLES.btnSubmitWaitlist}>
                                  {submittingWaitlist ? '...' : 'Kirim'}
                                </button>
                                <button 
                                  type="button" 
                                  onClick={() => setActiveWaitlistProductId(null)} 
                                  style={STYLES.btnCancelWaitlist}
                                >
                                  ✕
                                </button>
                              </div>
                            </form>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const STYLES: Record<string, CSSProperties> = {
  page: { 
    backgroundImage: 'url("/bg-product.png")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundAttachment: 'fixed',
    backgroundColor: '#f8fafc', 
    minHeight: '100vh', 
    padding: '16px 12px', 
    fontFamily: '"Inter", "Segoe UI", sans-serif' 
  },
  
  container: { maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  pageTitle: { margin: 0, fontSize: 19, fontWeight: 800, color: '#0f172a', textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)' },
  pageDesc: { margin: '2px 0 0', color: '#334155', fontSize: 12, fontWeight: 600, textShadow: '0 1px 2px rgba(255, 255, 255, 0.8)' },
  btnSecondary: { background: 'rgba(255,255,255,0.92)', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontWeight: 600, fontSize: 11.5 },
  btnPrimaryAction: { background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontWeight: 600, fontSize: 11.5 },
  
  noticeBox: { background: 'rgba(239, 246, 255, 0.92)', border: '1px solid #bfdbfe', borderRadius: 6, padding: '8px 12px', display: 'flex', gap: 6, alignItems: 'center' },
  noticeTitle: { fontSize: 12, fontWeight: 700, color: '#1e40af', whiteSpace: 'nowrap' },
  noticeText: { margin: 0, fontSize: 11.5, color: '#1e3a8a', lineHeight: 1.3 },

  loader: { textAlign: 'center', padding: '20px', color: '#1e293b', fontSize: 13, fontWeight: 700 },
  emptyBox: { background: 'rgba(255,255,255,0.92)', padding: '16px', borderRadius: 8, textAlign: 'center', color: '#475569', border: '1px solid #e2e8f0', fontSize: 12.5 },
  
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 },
  
  card: { 
    position: 'relative', 
    background: '#ffffff', 
    borderRadius: 8, 
    overflow: 'hidden', 
    border: '1px solid #cbd5e1', 
    boxShadow: '0 2px 6px rgba(15, 23, 42, 0.06)', 
    display: 'flex', 
    flexDirection: 'column',
    minHeight: 160 
  },

  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundSize: 'contain',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundColor: '#ffffff',
    zIndex: 1
  },

  cardContent: { 
    position: 'relative', 
    zIndex: 2, 
    padding: '8px', 
    display: 'flex', 
    flexDirection: 'column', 
    gap: 4, 
    flex: 1
  },

  textBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  },
  
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 },
  productTitle: { 
    margin: 0, 
    fontSize: 13.5, 
    fontWeight: 800, 
    lineHeight: 1.25,
    color: '#0f172a'
  },
  badge: { 
    padding: '2px 5px', 
    borderRadius: 4, 
    fontSize: 9.5, 
    fontWeight: 700, 
    whiteSpace: 'nowrap',
    background: '#e0e7ff',
    color: '#3730a3',
    border: '1px solid #c7d2fe'
  },
  productDesc: { 
    margin: 0, 
    fontSize: 11.5, 
    lineHeight: 1.35, 
    fontWeight: 500,
    color: '#334155'
  },
  btnToggleDetail: {
    background: 'none',
    border: 'none',
    color: '#2563eb',
    fontSize: 10.5,
    fontWeight: 700,
    cursor: 'pointer',
    padding: '2px 0 0',
    display: 'inline-block',
    textAlign: 'left'
  },
  
  btnLink: { 
    fontWeight: 800, 
    textDecoration: 'none', 
    fontSize: 11.5, 
    display: 'inline-block',
    color: '#1d4ed8'
  },
  btnComingSoon: { 
    background: '#f1f5f9', 
    color: '#475569', 
    border: '1px solid #cbd5e1', 
    borderRadius: 4, 
    padding: '4px 6px', 
    fontSize: 10.5, 
    fontWeight: 700, 
    cursor: 'not-allowed', 
    flex: 1, 
    textAlign: 'center'
  },
  btnNotifyMe: { 
    background: '#2563eb', 
    color: '#ffffff', 
    border: 'none', 
    borderRadius: 4, 
    padding: '4px 6px', 
    fontSize: 10.5, 
    fontWeight: 700, 
    cursor: 'pointer', 
    flex: 1, 
    textAlign: 'center'
  },

  waitlistForm: { background: 'rgba(255, 255, 255, 0.98)', border: '1px solid #cbd5e1', borderRadius: 4, padding: '4px' },
  waitlistInput: { flex: 1, padding: '2px 6px', borderRadius: 3, border: '1px solid #cbd5e1', fontSize: 10.5, outline: 'none', color: '#0f172a' },
  btnSubmitWaitlist: { background: '#2563eb', color: '#fff', border: 'none', borderRadius: 3, padding: '2px 6px', fontSize: 10.5, fontWeight: 600, cursor: 'pointer' },
  btnCancelWaitlist: { background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: 3, padding: '2px 4px', fontSize: 10, cursor: 'pointer', fontWeight: 700 }
};