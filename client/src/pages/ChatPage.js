import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { blockAPI, chatAPI, reportAPI } from '../api';
import { useAuth } from '../AuthContext';
import toast from 'react-hot-toast';
import { io } from 'socket.io-client';
import { BACKEND_URL } from '../config';

export default function ChatPage() {
  const { conversationId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  const fetchConversations = useCallback(async () => {
    try {
      const { data } = await chatAPI.getConversations();
      setConversations(data.conversations);
    } catch { toast.error('Failed to load conversations'); }
    finally { setLoading(false); }
  }, []);

  const openConversation = useCallback(async (conv) => {
    setActiveConv(conv);
    navigate(`/chat/${conv._id}`, { replace: true });
    socketRef.current?.emit('join-conversation', conv._id);
    try {
      const { data } = await chatAPI.getMessages(conv._id);
      setMessages(data.messages);
    } catch { toast.error('Failed to load messages'); }
  }, [navigate]);

  useEffect(() => {
    if (!user?._id) return undefined;

    socketRef.current = io(BACKEND_URL, {
      transports: ['websocket'],
      auth: { token: localStorage.getItem('token') },
    });
    socketRef.current.emit('user-online', user._id);
    socketRef.current.on('receive-message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });
    socketRef.current.on('user-typing', () => setIsTyping(true));
    socketRef.current.on('user-stop-typing', () => setIsTyping(false));
    return () => socketRef.current?.disconnect();
  }, [user?._id]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (conversationId) {
      const found = conversations.find(c => c._id === conversationId);
      if (found) openConversation(found);
    }
  }, [conversationId, conversations, openConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim() || !activeConv) return;
    try {
      setSending(true);
      const { data } = await chatAPI.sendMessage(activeConv._id, { text });
      setMessages(prev => [...prev, data.message]);
      socketRef.current?.emit('send-message', { conversationId: activeConv._id, ...data.message });
      setText('');
    } catch { toast.error('Failed to send message'); }
    finally { setSending(false); }
  };

  const handleTyping = (e) => {
    setText(e.target.value);
    socketRef.current?.emit('typing', { conversationId: activeConv?._id, userId: user._id });
    clearTimeout(window._typingTimer);
    window._typingTimer = setTimeout(() => {
      socketRef.current?.emit('stop-typing', { conversationId: activeConv?._id });
    }, 1500);
  };

  const sendMeetup = async () => {
    const location = prompt('Enter meetup location:');
    const date = prompt('Enter meetup date (e.g., Tomorrow, 15 April):');
    const time = prompt('Enter meetup time (e.g., 3:00 PM):');
    if (!location || !date || !time) return;
    const meetupText = `📍 Meetup Request\nLocation: ${location}\nDate: ${date}\nTime: ${time}`;
    try {
      const { data } = await chatAPI.sendMessage(activeConv._id, { text: meetupText, type: 'meetup', meetupDetails: { location, date, time } });
      setMessages(prev => [...prev, data.message]);
    } catch { toast.error('Failed to send meetup request'); }
  };

  const sendOffer = async () => {
    const price = prompt('Enter your offer price (₹):');
    if (!price || isNaN(price)) return;
    const offerText = `💰 Price Offer: ₹${parseInt(price).toLocaleString()}`;
    try {
      const { data } = await chatAPI.sendMessage(activeConv._id, { text: offerText, type: 'offer', offerPrice: parseInt(price) });
      setMessages(prev => [...prev, data.message]);
    } catch { toast.error('Failed to send offer'); }
  };

  const getOtherUser = (conv) => {
    if (!conv) return {};
    return user.role === 'customer' ? conv.vendor : conv.customer;
  };

  const handleReportConversation = async () => {
    if (!activeConv) return;
    const otherUser = getOtherUser(activeConv);
    const reason = prompt('Why are you reporting this conversation?');
    if (!reason?.trim()) return;
    const details = prompt('Add any extra details (optional):') || '';

    try {
      await reportAPI.create({
        conversation: activeConv._id,
        reportedUser: otherUser?._id,
        reason,
        details,
      });
      toast.success('Report submitted');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit report');
    }
  };

  const handleBlockUser = async () => {
    if (!activeConv) return;
    const otherUser = getOtherUser(activeConv);
    if (!otherUser?._id) return;

    const confirmed = window.confirm(`Block ${otherUser.name || 'this user'}? They will not be able to message you.`);
    if (!confirmed) return;

    try {
      await blockAPI.blockUser({
        blockedUser: otherUser._id,
        conversation: activeConv._id,
      });
      toast.success('User blocked');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to block user');
    }
  };

  return (
    <div className="container py-3 py-md-4">
      <h5 className="fw-bold mb-3"><i className="bi bi-chat-dots me-2" style={{color:'#FF6B35'}}></i>Messages</h5>
      <div className="chat-container bg-white rounded-4 shadow">
        {/* Sidebar */}
        <div className="chat-sidebar">
          <div className="p-3 border-bottom">
            <small className="text-muted fw-semibold">CONVERSATIONS ({conversations.length})</small>
          </div>
          {loading ? (
            <div className="text-center py-4"><div className="spinner-border spinner-border-sm text-warning"></div></div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-5 px-3">
              <i className="bi bi-chat display-4 text-muted"></i>
              <p className="text-muted small mt-2">No conversations yet</p>
              <Link to="/" className="btn btn-sm btn-primary-custom">Browse Products</Link>
            </div>
          ) : (
            conversations.map(conv => {
              const other = getOtherUser(conv);
              const isActive = activeConv?._id === conv._id;
              return (
                <div key={conv._id} className={`conversation-item ${isActive ? 'active' : ''}`} onClick={() => openConversation(conv)}>
                  <div className="d-flex gap-2 align-items-start">
                    <div className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0"
                      style={{width:40,height:40,background:'linear-gradient(135deg,#FF6B35,#e55a24)',fontSize:'1rem'}}>
                      {other?.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="overflow-hidden flex-grow-1">
                      <div className="d-flex justify-content-between">
                        <span className="fw-semibold small text-truncate">{other?.name || 'User'}</span>
                        <span className="text-muted" style={{fontSize:'0.7rem'}}>
                          {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : ''}
                        </span>
                      </div>
                      <div className="text-muted small text-truncate">{conv.product?.title}</div>
                      <div className="text-muted text-truncate" style={{fontSize:'0.78rem'}}>{conv.lastMessage || 'Start conversation'}</div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Main Chat */}
        <div className="chat-main">
          {!activeConv ? (
            <div className="flex-grow-1 d-flex align-items-center justify-content-center">
              <div className="text-center text-muted p-4">
                <i className="bi bi-chat-left-dots display-2 mb-3"></i>
                <h6>Select a conversation</h6>
                <p className="small">Choose from your conversations or start one from a product page</p>
              </div>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="p-3 bg-white border-bottom d-flex align-items-center gap-3">
                <div className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold"
                  style={{width:42,height:42,background:'linear-gradient(135deg,#FF6B35,#e55a24)'}}>
                  {getOtherUser(activeConv)?.name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <div className="fw-bold">{getOtherUser(activeConv)?.name}</div>
                  <small className="text-muted">{activeConv.product?.title}</small>
                </div>
                <div className="ms-auto d-flex align-items-center gap-2 flex-wrap justify-content-end">
                  <button className="btn btn-sm btn-outline-danger" onClick={handleReportConversation}>
                    <i className="bi bi-flag me-1"></i>Report
                  </button>
                  <button className="btn btn-sm btn-outline-secondary" onClick={handleBlockUser}>
                    <i className="bi bi-slash-circle me-1"></i>Block User
                  </button>
                  <span className="badge" style={{background:'#FF6B35',color:'#fff'}}>
                    ₹{activeConv.product?.price?.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Messages */}
              <div className="chat-messages">
                {messages.length === 0 ? (
                  <div className="text-center text-muted py-5">
                    <i className="bi bi-chat-dots display-4 mb-2"></i>
                    <p>Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg, i) => {
                    const isMine = msg.sender?._id === user._id || msg.sender === user._id;
                    return (
                      <div key={i} className={`d-flex mb-2 ${isMine ? 'justify-content-end' : 'justify-content-start'}`}>
                        <div className={`message-bubble ${isMine ? 'sent' : 'received'}`}>
                          {msg.text}
                          <div className={`mt-1 ${isMine ? 'text-white opacity-75' : 'text-muted'}`} style={{fontSize:'0.68rem'}}>
                            {new Date(msg.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                            {isMine && <i className={`bi ${msg.isRead ? 'bi-check2-all' : 'bi-check2'} ms-1`}></i>}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                {isTyping && (
                  <div className="d-flex justify-content-start">
                    <div className="message-bubble received">
                      <div className="d-flex gap-1 align-items-center">
                        <span className="rounded-circle bg-secondary" style={{width:6,height:6,display:'inline-block',animation:'pulse 1s infinite'}}></span>
                        <span className="rounded-circle bg-secondary" style={{width:6,height:6,display:'inline-block',animation:'pulse 1s infinite 0.2s'}}></span>
                        <span className="rounded-circle bg-secondary" style={{width:6,height:6,display:'inline-block',animation:'pulse 1s infinite 0.4s'}}></span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Actions */}
              <div className="px-3 pt-2 d-flex gap-2">
                <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={sendOffer}>
                  <i className="bi bi-tag me-1"></i>Make Offer
                </button>
                <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={sendMeetup}>
                  <i className="bi bi-geo-alt me-1"></i>Arrange Meetup
                </button>
              </div>

              {/* Input */}
              <div className="chat-input-area">
                <form onSubmit={handleSend} className="d-flex gap-2">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Type a message..."
                    value={text}
                    onChange={handleTyping}
                    style={{borderRadius:24}}
                  />
                  <button type="submit" className="btn btn-primary-custom rounded-circle d-flex align-items-center justify-content-center"
                    style={{width:42,height:42,flexShrink:0}} disabled={sending || !text.trim()}>
                    {sending ? <span className="spinner-border spinner-border-sm"></span> : <i className="bi bi-send-fill"></i>}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
