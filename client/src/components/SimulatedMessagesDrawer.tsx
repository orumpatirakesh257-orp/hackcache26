import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Phone, RefreshCw } from 'lucide-react';
import { SimulatedMessage } from '../../../shared/types';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SimulatedMessagesDrawer: React.FC<DrawerProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<SimulatedMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/reports/messages');
      const data = await res.json();
      setMessages(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMessages();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col border-l border-slate-200">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-teal-50">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-teal-600 text-white rounded-xl">
              <MessageSquare size={20} />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-800">Simulated Outbox (SMS & WhatsApp)</h2>
              <p className="text-xs text-slate-500">Live demonstration of patient notifications</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={fetchMessages}
              disabled={loading}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 transition"
              title="Refresh messages"
            >
              <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center py-16 text-slate-400 space-y-2">
              <MessageSquare size={36} className="mx-auto text-slate-300" />
              <p className="text-sm font-medium">No messages sent yet</p>
              <p className="text-xs text-slate-400">
                Messages will appear here when a patient registers or a doctor clicks "Call Next".
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-3.5 rounded-2xl border ${
                  msg.channel === 'WhatsApp'
                    ? 'border-emerald-300 bg-emerald-50/50'
                    : 'border-blue-200 bg-blue-50/50'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span
                    className={`font-bold px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider ${
                      msg.channel === 'WhatsApp'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-blue-600 text-white'
                    }`}
                  >
                    {msg.channel}
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    {new Date(msg.sentAt).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-xs font-semibold text-slate-700 flex items-center gap-1 mt-1">
                  <Phone size={11} className="text-slate-400" />
                  <span>To: {msg.recipientPhone}</span>
                </div>
                <p className="text-sm text-slate-800 mt-2 font-medium leading-snug">
                  {msg.content}
                </p>
              </div>
            ))
          )}
        </div>

        <div className="p-3 border-t border-slate-200 bg-slate-50 text-center">
          <p className="text-xs text-slate-500">
            Automated SMS & WhatsApp delivery simulation for demo audit
          </p>
        </div>
      </div>
    </div>
  );
};
