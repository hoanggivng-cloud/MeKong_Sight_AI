import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Droplets, Thermometer, Wind, AlertCircle, TrendingUp, History, Loader2, Database, RefreshCcw, Brain, CheckCircle2, ChevronRight } from 'lucide-react';

export const Dashboard: React.FC = () => {
    const [stats, setStats] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [readings, setReadings] = useState<any[]>([]);
    const [farms, setFarms] = useState<any[]>([]);
    const [recommendation, setRecommendation] = useState<any>(null);

    const fetchData = async () => {
        setRefreshing(true);
        try {
            const farmRes = await api.get('/farms/my');
            const farmlist = farmRes.data.data || [];
            setFarms(farmlist);
            const totalArea = farmlist.reduce((acc: number, f: any) => acc + (f.area_hectares || 0), 0);

            const sensorRes = await api.get('/iot/readings');
            const latestReadings = sensorRes.data.data || [];
            setReadings(latestReadings);

            const latest = latestReadings[0] || {};

            // Fetch recommendation if farm exists
            if (farmlist.length > 0) {
                // For demo, we get the latest recommendation
                const recRes = await api.get('/ai/recommendations/' + farmlist[0].id);
                if (recRes.data.data) {
                    setRecommendation(recRes.data.data);
                }
            }

            const newStats = [
                {
                    label: 'Độ mặn hiện tại',
                    value: latest.salinity ? `${latest.salinity}‰` : '---',
                    icon: <Droplets size={24} color="#3b82f6" />,
                    change: latest.salinity > 2 ? 'Cảnh báo' : 'An toàn',
                    trend: latest.salinity > 2 ? 'up' : 'down'
                },
                {
                    label: 'Nhiệt độ nước',
                    value: latest.temperature ? `${latest.temperature}°C` : '---',
                    icon: <Thermometer size={24} color="#f59e0b" />,
                    change: 'Ổn định',
                    trend: 'neutral'
                },
                {
                    label: 'Độ pH hiện tại',
                    value: latest.ph ? latest.ph : '---',
                    icon: <Wind size={24} color="#10b981" />,
                    change: (latest.ph >= 7 && latest.ph <= 9) ? 'Lý tưởng' : 'Cần chú ý',
                    trend: 'neutral'
                },
                {
                    label: 'Diện tích canh tác',
                    value: `${totalArea.toFixed(1)} ha`,
                    icon: <TrendingUp size={24} color="#8b5cf6" />,
                    change: `${farmlist.length} vùng`,
                    trend: 'neutral'
                },
            ];

            setStats(newStats);
        } catch (err) {
            console.error("Dashboard fetch error:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const runAI = async () => {
        if (farms.length === 0) return;
        setAnalyzing(true);
        try {
            await api.post('/ai/analyze', { farm_id: farms[0].id, analysis_type: 'salinity_forecast' });
            // Wait a bit then refresh
            setTimeout(fetchData, 2000);
        } catch (err) {
            console.error(err);
        } finally {
            setTimeout(() => setAnalyzing(false), 2000);
        }
    };

    const seedData = async () => {
        if (!confirm('Khởi tạo dữ liệu mẫu cho vùng lúa - tôm?')) return;
        setRefreshing(true);
        try {
            const farmData = {
                farm_name: "Lô ST25 Thực nghiệm",
                area_hectares: 2.5,
                farm_type: "shrimp_rice"
            };
            await api.post('/farms', farmData);
            fetchData();
        } catch (err: any) {
            console.error("Seed error:", err);
            const msg = err.response?.data?.message || err.message || 'Không xách định';
            alert(`Lỗi khi tạo dữ liệu mẫu: ${msg}`);
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 15000);
        return () => clearInterval(interval);
    }, []);

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
            <Loader2 className="animate-spin" size={40} color="var(--primary-glow)" />
        </div>
    );

    return (
        <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
            <div className="flex justify-between items-center" style={{ marginBottom: '2.5rem' }}>
                <div>
                    <h1 style={{ marginBottom: '0.5rem' }}>Bảng điều khiển</h1>
                    <p className="text-secondary">Giám sát theo thời gian thực và Khuyến nghị AI thông minh.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="secondary" onClick={fetchData} disabled={refreshing}>
                        <RefreshCcw size={18} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                    <button className="primary" onClick={seedData}>
                        <Database size={18} /> Mẫu Lúa-Tôm
                    </button>
                </div>
            </div>

            <div className="grid">
                {stats.map((stat, i) => (
                    <div key={i} className="card">
                        <div className="flex justify-between items-center" style={{ marginBottom: '1.2rem' }}>
                            <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                                {stat.icon}
                            </div>
                            <span className={`status-tag status-${stat.trend === 'up' && i === 0 ? 'warning' : 'active'}`} style={{ fontSize: '0.7rem' }}>
                                {stat.change}
                            </span>
                        </div>
                        <p className="text-secondary" style={{ marginBottom: '0.2rem' }}>{stat.label}</p>
                        <h2 style={{ margin: 0, fontSize: '2rem' }}>{stat.value}</h2>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
                {/* Nhật ký */}
                <div className="card" style={{ minHeight: '400px' }}>
                    <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem' }}>
                        <h3>Nhật ký đo lường (24h)</h3>
                        <button className="secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                            <History size={14} /> Chi tiết
                        </button>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Thời gian</th>
                                    <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Độ mặn</th>
                                    <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>pH / Nhiệt độ</th>
                                    <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {readings.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} style={{ padding: '3rem', textAlign: 'center' }} className="text-secondary">Chưa có dữ liệu cảm biến.</td>
                                    </tr>
                                ) : (
                                    readings.map((r, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                            <td style={{ padding: '1rem', fontSize: '0.85rem' }}>{new Date(r.timestamp).toLocaleTimeString()}</td>
                                            <td style={{ padding: '1rem', fontWeight: 600, color: r.salinity > 2 ? '#f87171' : 'white' }}>{r.salinity}‰</td>
                                            <td style={{ padding: '1rem', fontSize: '0.85rem' }}>{r.ph} / {r.temperature}°C</td>
                                            <td style={{ padding: '1rem' }}>
                                                <span className={`status-tag status-${r.salinity > 2 ? 'warning' : 'active'}`} style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                                                    {r.salinity > 2 ? 'Vượt ngưỡng' : 'An toàn'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* AI Recommendation */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="flex items-center gap-2" style={{ marginBottom: '1.5rem' }}>
                        <Brain size={20} color="var(--primary-glow)" />
                        <h3 style={{ margin: 0 }}>Cố vấn AI</h3>
                    </div>

                    {!recommendation ? (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '1rem' }}>
                            <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                                <AlertCircle size={30} color="#3b82f6" />
                            </div>
                            <p className="text-secondary" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>Chưa có phân tích mới nhất cho mô hình của bạn.</p>
                            <button className="primary" onClick={runAI} disabled={analyzing} style={{ width: '100%' }}>
                                {analyzing ? <Loader2 className="animate-spin" size={18} /> : 'Chạy phân tích AI'}
                            </button>
                        </div>
                    ) : (
                        <div style={{ animation: 'fadeIn 0.3s' }}>
                            <div className="card glass-card" style={{ padding: '1.2rem', marginBottom: '1.5rem', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                <div className="flex items-center gap-2" style={{ marginBottom: '0.8rem', color: '#10b981' }}>
                                    <CheckCircle2 size={18} />
                                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Khuyến nghị hiện tại</span>
                                </div>
                                <h4 style={{ margin: '0 0 0.5rem 0', color: 'white' }}>{recommendation.recommended_action}</h4>
                                <p className="text-secondary" style={{ fontSize: '0.85rem', lineHeight: 1.5, margin: 0 }}>
                                    {recommendation.explanation}
                                </p>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Dự báo 3 ngày tới</div>
                                <div className="flex justify-between items-center text-secondary" style={{ fontSize: '0.9rem' }}>
                                    <span>Xu hướng mặn:</span>
                                    <span style={{ color: recommendation.salinity_trend === 'decreasing' ? '#10b981' : '#f87171', fontWeight: 600 }}>
                                        {recommendation.salinity_trend === 'decreasing' ? 'Đang giảm' : 'Tăng nhẹ'}
                                    </span>
                                </div>
                                <button className="secondary" style={{ width: '100%', justifyContent: 'space-between', marginTop: '1rem' }}>
                                    Xem kế hoạch mùa vụ <ChevronRight size={16} />
                                </button>
                                <button className="primary" onClick={runAI} disabled={analyzing} style={{ width: '100%', height: '38px', fontSize: '0.8rem' }}>
                                    {analyzing ? <Loader2 className="animate-spin" size={16} /> : 'Cập nhật phân tích'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
