import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Avatar from './Avatar'

export default function SupportTicketsModal({ onClose }) {
  const { user, profile, isOwner } = useAuth()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list') // 'list' | 'create' | 'detail'
  const [selectedTicket, setSelectedTicket] = useState(null)

  // New Ticket Form State
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('General')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Reply State
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)

  const fetchTickets = async () => {
    if (!user) return
    setLoading(true)
    try {
      let query = supabase.from('support_tickets').select('*').order('created_at', { ascending: false })
      if (!isOwner) {
        query = query.eq('user_id', user.id)
      }
      const { data, error: err } = await query
      if (!err && data) {
        setTickets(data)
      } else {
        // LocalStorage fallback if table doesn't exist yet
        const local = JSON.parse(localStorage.getItem('chupa-support-tickets') || '[]')
        const filtered = isOwner ? local : local.filter(t => t.user_id === user.id)
        setTickets(filtered)
      }
    } catch {
      const local = JSON.parse(localStorage.getItem('chupa-support-tickets') || '[]')
      const filtered = isOwner ? local : local.filter(t => t.user_id === user.id)
      setTickets(filtered)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTickets()
  }, [user, isOwner])

  const handleCreateTicket = async (e) => {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) {
      setError('Please fill in both subject and description')
      return
    }
    setSubmitting(true)
    setError('')

    const newTicket = {
      id: crypto.randomUUID ? crypto.randomUUID() : `ticket-${Date.now()}`,
      user_id: user.id,
      user_name: profile?.name || 'User',
      user_username: profile?.username || 'user',
      subject: subject.trim(),
      category,
      status: 'open',
      replies: [
        {
          id: `msg-${Date.now()}`,
          sender_id: user.id,
          sender_name: profile?.name || 'User',
          sender_username: profile?.username || 'user',
          text: message.trim(),
          created_at: new Date().toISOString(),
        }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    try {
      const { error: dbErr } = await supabase.from('support_tickets').insert(newTicket)
      if (dbErr) {
        console.warn('DB insert error fallback to local:', dbErr)
      }
    } catch (err) {
      console.warn('DB exception fallback:', err)
    }

    // Save to local storage cache
    const local = JSON.parse(localStorage.getItem('chupa-support-tickets') || '[]')
    localStorage.setItem('chupa-support-tickets', JSON.stringify([newTicket, ...local]))

    setTickets(prev => [newTicket, ...prev])
    setSubject('')
    setMessage('')
    setSubmitting(false)
    setView('list')
  }

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedTicket) return
    setReplying(true)

    const replyObj = {
      id: `msg-${Date.now()}`,
      sender_id: user.id,
      sender_name: profile?.name || 'User',
      sender_username: profile?.username || 'user',
      is_owner: isOwner,
      text: replyText.trim(),
      created_at: new Date().toISOString(),
    }

    const updatedReplies = [...(selectedTicket.replies || []), replyObj]
    const updatedTicket = {
      ...selectedTicket,
      replies: updatedReplies,
      status: isOwner && selectedTicket.status === 'open' ? 'in_progress' : selectedTicket.status,
      updated_at: new Date().toISOString(),
    }

    try {
      await supabase.from('support_tickets').update({
        replies: updatedReplies,
        status: updatedTicket.status,
        updated_at: updatedTicket.updated_at,
      }).eq('id', selectedTicket.id)
    } catch (err) {
      console.warn('Update ticket DB error:', err)
    }

    const local = JSON.parse(localStorage.getItem('chupa-support-tickets') || '[]')
    const updatedLocal = local.map(t => t.id === selectedTicket.id ? updatedTicket : t)
    localStorage.setItem('chupa-support-tickets', JSON.stringify(updatedLocal))

    setSelectedTicket(updatedTicket)
    setTickets(prev => prev.map(t => t.id === selectedTicket.id ? updatedTicket : t))
    setReplyText('')
    setReplying(false)
  }

  const handleStatusChange = async (newStatus) => {
    if (!selectedTicket) return
    const updatedTicket = { ...selectedTicket, status: newStatus, updated_at: new Date().toISOString() }

    try {
      await supabase.from('support_tickets').update({ status: newStatus, updated_at: updatedTicket.updated_at }).eq('id', selectedTicket.id)
    } catch { /* ignore */ }

    const local = JSON.parse(localStorage.getItem('chupa-support-tickets') || '[]')
    const updatedLocal = local.map(t => t.id === selectedTicket.id ? updatedTicket : t)
    localStorage.setItem('chupa-support-tickets', JSON.stringify(updatedLocal))

    setSelectedTicket(updatedTicket)
    setTickets(prev => prev.map(t => t.id === selectedTicket.id ? updatedTicket : t))
  }

  const statusBadge = (status) => {
    switch (status) {
      case 'resolved':
        return <span style={{ fontSize: 11, fontWeight: 800, color: '#10B981', background: 'rgba(16,185,129,0.15)', padding: '2px 8px', borderRadius: 99 }}>✅ Resolved</span>
      case 'in_progress':
        return <span style={{ fontSize: 11, fontWeight: 800, color: '#F59E0B', background: 'rgba(245,158,11,0.15)', padding: '2px 8px', borderRadius: 99 }}>🟡 In Progress</span>
      default:
        return <span style={{ fontSize: 11, fontWeight: 800, color: '#3B82F6', background: 'rgba(59,130,246,0.15)', padding: '2px 8px', borderRadius: 99 }}>🟢 Open</span>
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 450,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="fade-in-scale"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 440, background: 'var(--c-surface)',
          border: '1px solid var(--c-border)', borderRadius: 22,
          padding: '24px 20px', boxShadow: 'var(--shadow-lg)',
          display: 'flex', flexDirection: 'column', maxHeight: '85vh',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--c-text)', margin: 0 }}>
              {isOwner ? '👑 Owner Support Desk' : '🎧 Help & Support Tickets'}
            </h3>
            <p style={{ fontSize: 12, color: 'var(--c-text-tertiary)', margin: '2px 0 0' }}>
              {isOwner ? 'Review and resolve support tickets raised by users' : 'Raise a ticket to get help directly from @subhro'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--c-text-tertiary)', cursor: 'pointer' }}>✕</button>
        </div>

        {/* View Switcher */}
        {view === 'list' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!isOwner && (
              <button
                onClick={() => setView('create')}
                style={{
                  width: '100%', padding: '11px 0', fontSize: 14, fontWeight: 700,
                  background: 'var(--c-accent)', color: '#fff', border: 'none',
                  borderRadius: 12, cursor: 'pointer', marginBottom: 14,
                }}
              >
                + Raise New Support Ticket
              </button>
            )}

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {loading ? (
                <p style={{ fontSize: 13, color: 'var(--c-text-tertiary)', textAlign: 'center', padding: 30 }}>Loading tickets...</p>
              ) : tickets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text)', margin: '0 0 4px' }}>No support tickets</p>
                  <p style={{ fontSize: 12.5, color: 'var(--c-text-tertiary)', margin: 0 }}>
                    {isOwner ? 'No tickets raised by users yet' : 'Raise a ticket above if you encounter any bugs or need assistance'}
                  </p>
                </div>
              ) : (
                tickets.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => { setSelectedTicket(t); setView('detail') }}
                    style={{
                      padding: '13px 14px', borderRadius: 14, background: 'var(--c-bg)',
                      border: '1px solid var(--c-border)', cursor: 'pointer',
                      transition: 'border-color 150ms',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-tertiary)', textTransform: 'uppercase' }}>
                        {t.category}
                      </span>
                      {statusBadge(t.status)}
                    </div>
                    <h4 style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--c-text)', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.subject}
                    </h4>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--c-text-tertiary)' }}>
                      <span>By @{t.user_username || 'user'}</span>
                      <span>{new Date(t.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Create Ticket View */}
        {view === 'create' && (
          <form onSubmit={handleCreateTicket} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--c-text-secondary)', marginBottom: 5 }}>
                CATEGORY
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', fontSize: 14,
                  background: 'var(--c-bg)', border: '1.5px solid var(--c-border)',
                  borderRadius: 10, color: 'var(--c-text)', outline: 'none',
                }}
              >
                <option value="General">General Question</option>
                <option value="Bug Report">Bug Report</option>
                <option value="Account">Account Issue</option>
                <option value="Feature Request">Feature Request</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--c-text-secondary)', marginBottom: 5 }}>
                SUBJECT / TOPIC
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of the issue..."
                autoFocus
                style={{
                  width: '100%', padding: '10px 12px', fontSize: 14,
                  background: 'var(--c-bg)', border: '1.5px solid var(--c-border)',
                  borderRadius: 10, color: 'var(--c-text)', outline: 'none',
                }}
              />
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--c-text-secondary)', marginBottom: 5 }}>
                DESCRIPTION
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your issue or request in detail..."
                style={{
                  width: '100%', flex: 1, minHeight: 110, padding: '10px 12px', fontSize: 14,
                  background: 'var(--c-bg)', border: '1.5px solid var(--c-border)',
                  borderRadius: 10, color: 'var(--c-text)', outline: 'none', resize: 'none',
                }}
              />
            </div>

            {error && <p style={{ fontSize: 12, color: 'var(--c-danger)', margin: 0 }}>{error}</p>}

            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button
                type="button"
                onClick={() => setView('list')}
                style={{
                  flex: 1, padding: '11px 0', fontSize: 14, fontWeight: 600,
                  background: 'var(--c-bg)', color: 'var(--c-text-secondary)',
                  border: '1px solid var(--c-border)', borderRadius: 10, cursor: 'pointer',
                }}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  flex: 1, padding: '11px 0', fontSize: 14, fontWeight: 700,
                  background: 'var(--c-accent)', color: '#fff', border: 'none',
                  borderRadius: 10, cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Submitting...' : 'Submit Ticket'}
              </button>
            </div>
          </form>
        )}

        {/* Ticket Detail View */}
        {view === 'detail' && selectedTicket && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <button
                onClick={() => setView('list')}
                style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--c-accent)', fontWeight: 700, cursor: 'pointer', padding: 0 }}
              >
                ← Back to Tickets
              </button>
              {statusBadge(selectedTicket.status)}
            </div>

            <h4 style={{ fontSize: 16, fontWeight: 800, color: 'var(--c-text)', margin: '0 0 4px' }}>
              {selectedTicket.subject}
            </h4>
            <p style={{ fontSize: 12, color: 'var(--c-text-tertiary)', margin: '0 0 12px' }}>
              Raised by @{selectedTicket.user_username} • {new Date(selectedTicket.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>

            {/* Change Status Options for Owner */}
            {isOwner && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <button
                  onClick={() => handleStatusChange('in_progress')}
                  style={{ flex: 1, padding: '6px 0', fontSize: 11.5, fontWeight: 700, background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: 'none', borderRadius: 8, cursor: 'pointer' }}
                >
                  Mark In Progress
                </button>
                <button
                  onClick={() => handleStatusChange('resolved')}
                  style={{ flex: 1, padding: '6px 0', fontSize: 11.5, fontWeight: 700, background: 'rgba(16,185,129,0.15)', color: '#10B981', border: 'none', borderRadius: 8, cursor: 'pointer' }}
                >
                  Mark Resolved
                </button>
              </div>
            )}

            {/* Replies List */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4, marginBottom: 12 }}>
              {selectedTicket.replies?.map((r) => (
                <div
                  key={r.id || Math.random()}
                  style={{
                    padding: '11px 13px', borderRadius: 12,
                    background: r.is_owner ? 'var(--c-accent-light)' : 'var(--c-bg)',
                    border: `1px solid ${r.is_owner ? 'var(--c-accent)' : 'var(--c-border)'}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--c-text)' }}>
                      {r.sender_name} {r.is_owner && '👑 (Owner)'}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--c-text-tertiary)' }}>
                      {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--c-text)', margin: 0, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                    {r.text}
                  </p>
                </div>
              ))}
            </div>

            {/* Reply Input */}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={isOwner ? "Reply to user as Owner..." : "Add a reply..."}
                style={{
                  flex: 1, padding: '10px 12px', fontSize: 13.5,
                  background: 'var(--c-bg)', border: '1.5px solid var(--c-border)',
                  borderRadius: 10, color: 'var(--c-text)', outline: 'none',
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSendReply() }}
              />
              <button
                onClick={handleSendReply}
                disabled={replying || !replyText.trim()}
                style={{
                  padding: '10px 16px', fontSize: 13.5, fontWeight: 700,
                  background: 'var(--c-accent)', color: '#fff', border: 'none',
                  borderRadius: 10, cursor: replying || !replyText.trim() ? 'not-allowed' : 'pointer',
                  opacity: replying || !replyText.trim() ? 0.6 : 1,
                }}
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
