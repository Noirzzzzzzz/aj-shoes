// src/hooks/useNotificationsWS.ts
import { useEffect, useRef, useState } from 'react';

const WS_BASE = import.meta.env.VITE_WS_BASE_URL || 
  (import.meta.env.VITE_API_BASE_URL?.replace('http', 'ws') || 'ws://localhost:8000');

export function useNotificationsWS(onMessage: (data: any) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const pollingRef = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const [usePolling, setUsePolling] = useState(false);

  // Polling fallback เมื่อ WebSocket ไม่ทำงาน
  const startPolling = () => {
    if (pollingRef.current || wsRef.current?.readyState === WebSocket.OPEN) return;
    
    console.log('🔄 Starting polling fallback (every 30 seconds)');
    setUsePolling(true);
    
    pollingRef.current = setInterval(async () => {
      // หยุด polling ถ้า WebSocket กลับมาทำงาน
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        stopPolling();
        return;
      }
      
      try {
        const token = localStorage.getItem('access');
        const headers: Record<string, string> = {
          'Accept': 'application/json',
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/notifications/?unread=true`, {
          credentials: 'include',
          headers
        });
        
        if (response.ok) {
          const notifications = await response.json();
          // เฉพาะการแจ้งเตือนใหม่ (เปรียบเทียบกับ localStorage)
          const lastCheck = localStorage.getItem('last_notification_check');
          const lastCheckTime = lastCheck ? new Date(lastCheck).getTime() : 0;
          
          const newNotifications = notifications.filter((n: any) => {
            const notifTime = new Date(n.created_at).getTime();
            return notifTime > lastCheckTime;
          });
          
          if (newNotifications.length > 0) {
            console.log(`📨 Polling found ${newNotifications.length} new notifications`);
            newNotifications.forEach(onMessage);
            localStorage.setItem('last_notification_check', new Date().toISOString());
          }
        }
      } catch (err) {
        console.warn('⚠️ Polling failed:', err);
      }
    }, 30000); // ทุก 30 วินาที
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = undefined;
      setUsePolling(false);
      console.log('⏹️ Stopped polling fallback');
    }
  };

  const connect = () => {
    try {
      // ตรวจสอบว่า backend รองรับ WebSocket หรือไม่
      if (!WS_BASE) {
        console.warn('⚠️ WebSocket URL not configured, using polling instead');
        startPolling();
        return;
      }

      const token = localStorage.getItem('access');
      let wsUrl;
      
      // ลองหลายรูปแบบ URL
      if (token) {
        wsUrl = `${WS_BASE}/ws/notifications/?token=${encodeURIComponent(token)}`;
      } else {
        wsUrl = `${WS_BASE}/ws/notifications/`;
      }

      console.log('🔗 Attempting WebSocket connection to:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Timeout สำหรับการเชื่อมต่อ
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          console.warn('⏰ WebSocket connection timeout, falling back to polling');
          ws.close();
          startPolling();
        }
      }, 10000); // 10 วินาที

      ws.onopen = () => {
        console.log('✅ WebSocket connected successfully');
        clearTimeout(connectionTimeout);
        reconnectAttempts.current = 0;
        stopPolling(); // หยุด polling เมื่อ WebSocket ทำงาน
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 WebSocket message received:', data);
          onMessage(data);
        } catch (err) {
          console.error('❌ Failed to parse WebSocket message:', err, event.data);
        }
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        clearTimeout(connectionTimeout);
        wsRef.current = null;

        // เฉพาะ error codes ที่ควร reconnect
        const shouldReconnect = [1000, 1001, 1006, 1011, 1012, 1013, 1014].includes(event.code);
        
        if (shouldReconnect && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          console.log(`🔄 Reconnecting in ${delay}ms... (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        } else if (!shouldReconnect || event.code === 1006) {
          console.warn('⚠️ WebSocket failed, switching to polling');
          // เริ่ม polling เมื่อ WebSocket ไม่สามารถเชื่อมต่อได้
          startPolling();
        } else {
          console.error('❌ Max reconnection attempts reached, falling back to polling');
          startPolling();
        }
      };

      ws.onerror = (error) => {
        console.error('🚨 WebSocket error:', {
          error,
          url: wsUrl,
          readyState: ws.readyState,
          states: {
            CONNECTING: WebSocket.CONNECTING,
            OPEN: WebSocket.OPEN,
            CLOSING: WebSocket.CLOSING,
            CLOSED: WebSocket.CLOSED
          }
        });
        clearTimeout(connectionTimeout);
        // ถ้าเกิด error ระหว่างการเชื่อมต่อ ให้เปลี่ยนไป polling
        if (ws.readyState === WebSocket.CONNECTING) {
          startPolling();
        }
      };

    } catch (err) {
      console.error('❌ Failed to create WebSocket connection:', err);
      startPolling();
    }
  };

  useEffect(() => {
    // ลองเชื่อมต่อ WebSocket ก่อน
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
        wsRef.current = null;
      }
    };
  }, []);

  // Reconnect when page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !wsRef.current) {
        console.log('🔄 Page visible, reconnecting WebSocket...');
        reconnectAttempts.current = 0;
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    isUsingPolling: usePolling,
    reconnect: () => {
      stopPolling();
      if (wsRef.current) {
        wsRef.current.close();
      }
      reconnectAttempts.current = 0;
      connect();
    }
  };
} 