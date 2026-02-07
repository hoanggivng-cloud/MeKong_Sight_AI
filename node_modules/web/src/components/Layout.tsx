import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Sprout, Users, Settings, LogOut, Waves, Bell, Brain } from 'lucide-react';

export const Layout: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    };

    const getUser = () => {
        try {
            const u = localStorage.getItem('user');
            if (!u || u === 'undefined') return {};
            return JSON.parse(u);
        } catch (e) {
            return {};
        }
    };

    const user = getUser();
    const role = user.role || 'farmer';

    const menuItems = [
        { path: '/', icon: <LayoutDashboard size={20} />, label: 'Tổng quan' },
        { path: '/farms', icon: <Sprout size={20} />, label: 'Trang trại' },
        { path: '/alerts', icon: <Bell size={20} />, label: 'Cảnh báo' },
        { path: '/analysis', icon: <Brain size={20} />, label: 'Phân tích' },
        ...(role === 'admin' ? [{ path: '/users', icon: <Users size={20} />, label: 'Người dùng' }] : []),
        { path: '/settings', icon: <Settings size={20} />, label: 'Cấu hình' },
    ];

    return (
        <div className="app-container">
            <aside className="sidebar">
                <div className="logo">
                    <Waves size={32} color="#3b82f6" />
                    Mekong AI
                </div>

                <nav style={{ flex: 1 }}>
                    {menuItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                        >
                            {item.icon}
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <button
                    onClick={handleLogout}
                    className="secondary"
                    style={{ marginTop: 'auto', width: '100%', justifyContent: 'flex-start' }}
                >
                    <LogOut size={20} />
                    Đăng xuất
                </button>
            </aside>

            <main className="main-content">
                <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <div className="flex items-center gap-2">
                        <span className="text-secondary">Xin chào,</span>
                        <span style={{ fontWeight: 600 }}>{user.full_name || user.phone_number || 'Khách'}</span>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--primary-gradient)', marginLeft: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                            {(user.full_name || 'K').charAt(0)}
                        </div>
                    </div>
                </header>
                <Outlet />
            </main>
        </div>
    );
};
