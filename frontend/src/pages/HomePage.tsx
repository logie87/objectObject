
//import React from 'react'; Home
import { useState } from 'react';

const Icons = {
  Settings: () => (
    <svg style={{ width: '32px', height: '32px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Home: () => (
    <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  User: () => (
    <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  Mail: () => (
    <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  Bell: () => (
    <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  FileText: () => (
    <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  BarChart: () => (
    <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  Calendar: () => (
    <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
};

export default function ModernHomepage() {
  const [activeTab, setActiveTab] = useState('home');

  const menuItems = [
    { id: 'home', label: 'Home', icon: 'Home' },
    { id: 'profile', label: 'Profile', icon: 'User' },
    { id: 'courses', label: 'Courses', icon: 'FileText' },
    { id: 'notifications', label: 'Notifications', icon: 'Bell' },
    { id: 'documents', label: 'Documents', icon: 'FileText' },
    { id: 'analytics', label: 'Analytics', icon: 'BarChart' },
    { id: 'calendar', label: 'Calendar', icon: 'Calendar' },
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', margin: 0, padding: 0, overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{
        width: '240px',
        background: 'linear-gradient(135deg, #a78bfa 0%, #a855f7 50%, #ec4899 100%)',
        position: 'relative',
        flexShrink: 0
      }}>
        {/* Settings Icon at Top */}
        <div style={{ padding: '24px' }}>
          <button style={{
            width: '64px',
            height: '64px',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(10px)',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.3s',
            color: 'white'
          }}>
            <Icons.Settings />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav style={{ marginTop: '32px', padding: '0 16px' }}>
          {menuItems.map((item) => {
            const IconComponent = Icons[item.icon as keyof typeof Icons];
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  transition: 'all 0.3s',
                  backgroundColor: isActive ? 'rgba(255, 255, 255, 0.3)' : 'transparent',
                  backdropFilter: isActive ? 'blur(10px)' : 'none',
                  boxShadow: isActive ? '0 4px 6px rgba(0, 0, 0, 0.1)' : 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'white',
                  marginBottom: '8px'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <IconComponent />
                <span style={{ fontWeight: '500' }}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Decorative Element */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '128px',
          background: 'linear-gradient(to top, rgba(0, 0, 0, 0.1), transparent)'
        }}></div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Projects Top Bar */}
        <div style={{
          backgroundColor: 'white',
          borderBottom: '1px solid #e5e7eb',
          padding: '16px 32px',
          overflowX: 'auto',
          display: 'flex',
          gap: '16px'
        }}>
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div
              key={item}
              style={{
                backgroundColor: '#f9fafb',
                borderRadius: '12px',
                padding: '12px 20px',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.3s',
                minWidth: '180px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                e.currentTarget.style.backgroundColor = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
                e.currentTarget.style.backgroundColor = '#f9fafb';
              }}
            >
              <div style={{
                width: '40px',
                height: '40px',
                background: 'linear-gradient(135deg, #a78bfa, #ec4899)',
                borderRadius: '10px',
                flexShrink: 0
              }}></div>
              <div>
                <h3 style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '2px'
                }}>
                  Notification {item}
                </h3>
                <p style={{ color: '#6b7280', fontSize: '12px' }}>
                  blabliblou
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#f9fafb' }}>
          <div style={{ padding: '32px' }}>
            <div style={{ maxWidth: '1152px', margin: '0 auto' }}>
              <h1 style={{ fontSize: '36px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>
                Welcome Back!
              </h1>
              <p style={{ color: '#6b7280', marginBottom: '32px' }}>
                Here's what's happening with your projects today.
              </p>

              {/* Additional Content */}
              <div style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '32px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
              }}>
                <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#1f2937', marginBottom: '16px' }}>
                  Recent Activity
                </h2>
                <p style={{ color: '#6b7280' }}>
                  Lalalilalou
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

























/*import { useState } from 'react';

const Icons = {
  Settings: () => (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Home: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  User: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  Mail: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  Bell: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  FileText: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  BarChart: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  Calendar: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
};

export default function ModernHomepage() {
  const [activeTab, setActiveTab] = useState('home');

  const menuItems = [
    { id: 'home', icon: 'Home', label: 'Home' },
    { id: 'profile', label: 'Profile' },
    { id: 'courses', icon: 'Mail', label: 'Courses' },
    { id: 'notifications', icon: 'Bell', label: 'Notifications' },
    { id: 'documents', icon: 'FileText', label: 'Documents' },
    { id: 'analytics', icon: 'BarChart', label: 'Analytics' },
    { id: 'calendar', icon: 'Calendar', label: 'Calendar' },
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', margin: 0, padding: 0, overflow: 'hidden' }}>*/
      {/* Sidebar */}/*
      <div style={{
        width: '240px',
        background: 'linear-gradient(135deg, #a78bfa 0%, #a855f7 50%, #ec4899 100%)',
        position: 'relative',
        flexShrink: 0
      }}>*/
        {/* Settings Icon at Top */}/*
        <div style={{ padding: '24px' }}>
          <button style={{
            width: '64px',
            height: '64px',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(10px)',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.3s',
            color: 'white'
          }}>
            <Icons.Settings />
          </button>
        </div>*/

        {/* Navigation Menu */}/*
        <nav style={{ marginTop: '32px', padding: '0 16px' }}>
          {menuItems.map((item) => {
            const IconComponent = Icons[item.icon as keyof typeof Icons];
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  transition: 'all 0.3s',
                  backgroundColor: isActive ? 'rgba(255, 255, 255, 0.3)' : 'transparent',
                  backdropFilter: isActive ? 'blur(10px)' : 'none',
                  boxShadow: isActive ? '0 4px 6px rgba(0, 0, 0, 0.1)' : 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'white',
                  marginBottom: '8px'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <IconComponent />
                <span style={{ fontWeight: '500' }}>{item.label}</span>
              </button>
            );
          })}
        </nav>*/

        {/* Bottom Decorative Element */}/*
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '128px',
          background: 'linear-gradient(to top, rgba(0, 0, 0, 0.1), transparent)'
        }}></div>
      </div>*/

      {/* Main Content Area */}/*
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>*/
        {/* Projects Top Bar */}/*
        <div style={{
          backgroundColor: 'white',
          borderBottom: '1px solid #e5e7eb',
          padding: '16px 32px',
          overflowX: 'auto',
          display: 'flex',
          gap: '16px'
        }}>
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div
              key={item}
              style={{
                backgroundColor: '#f9fafb',
                borderRadius: '12px',
                padding: '12px 20px',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.3s',
                minWidth: '180px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                e.currentTarget.style.backgroundColor = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
                e.currentTarget.style.backgroundColor = '#f9fafb';
              }}
            >
              <div style={{
                width: '40px',
                height: '40px',
                background: 'linear-gradient(135deg, #a78bfa, #ec4899)',
                borderRadius: '10px',
                flexShrink: 0
              }}></div>
              <div>
                <h3 style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '2px'
                }}>
                  Notification {item}
                </h3>
                <p style={{ color: '#6b7280', fontSize: '12px' }}>
                  blabliblou
                </p>
              </div>
            </div>
          ))}
        </div>*/

        {/* Content Area */}/*
        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: '#f9fafb' }}>
          <div style={{ padding: '32px' }}>
            <div style={{ maxWidth: '1152px', margin: '0 auto' }}>
              <h1 style={{ fontSize: '36px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>
                Welcome Back!
              </h1>
              <p style={{ color: '#6b7280', marginBottom: '32px' }}>
                Here's what's happening with your projects today.
              </p>
*/
              {/* Additional Content */}/*
              <div style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                padding: '32px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
              }}>
                <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#1f2937', marginBottom: '16px' }}>
                  Recent Activity
                </h2>
                <p style={{ color: '#6b7280' }}>
                Lalalilalou
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}*/