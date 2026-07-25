'use client';

import React, { useState, useEffect } from 'react';
import { Users, X, Edit2, Search, Filter, Check, Plus, FileSpreadsheet, Download, Save, UserX, UserCheck, Shield, Phone, Mail, MapPin } from 'lucide-react';

interface VolunteerManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  centers: any[];
  onRefresh: () => void;
}

export default function VolunteerManagementModal({ isOpen, onClose, centers, onRefresh }: VolunteerManagementModalProps) {
  const [volunteers, setVolunteers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCenterId, setFilterCenterId] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Active tab: 'ROSTER' | 'ADD_NEW' | 'BULK_CSV'
  const [activeTab, setActiveTab] = useState<'ROSTER' | 'ADD_NEW' | 'BULK_CSV'>('ROSTER');

  // Edit Volunteer Modal / Inline state
  const [editingVol, setEditingVol] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSkills, setEditSkills] = useState('');
  const [editRole, setEditRole] = useState('VOLUNTEER');
  const [editStatus, setEditStatus] = useState('ACTIVE');
  const [editCenterId, setEditCenterId] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Add New Volunteer Form state
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newSkills, setNewSkills] = useState('Mathematics, English');
  const [newRole, setNewRole] = useState('VOLUNTEER');
  const [newCenterId, setNewCenterId] = useState('');

  // Bulk CSV state
  const [csvText, setCsvText] = useState('Name, Email, Phone, Skills, Role\nRahul Sharma, rahul@example.com, +91 98765 11111, Math, VOLUNTEER\nSneha Roy, sneha@example.com, +91 98765 22222, English, COORDINATOR');
  const [csvMsg, setCsvMsg] = useState<string | null>(null);

  const fetchVolunteers = async () => {
    setLoading(true);
    try {
      // Pass unmask=true so admins/coordinators can see/update real phone numbers
      const res = await fetch('/api/volunteers?unmask=true');
      const data = await res.json();
      if (Array.isArray(data)) {
        setVolunteers(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchVolunteers();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOpenEdit = (vol: any) => {
    setEditingVol(vol);
    setEditName(vol.name || '');
    setEditEmail(vol.email || '');
    setEditPhone(vol.phone || vol.whatsappPhone || '');
    setEditSkills(vol.skills || '');
    setEditRole(vol.role || 'VOLUNTEER');
    setEditStatus(vol.status || 'ACTIVE');
    setEditCenterId(vol.centerId || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVol) return;
    setSavingEdit(true);

    try {
      const res = await fetch('/api/volunteers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingVol.id,
          name: editName,
          email: editEmail,
          phone: editPhone,
          whatsappPhone: editPhone,
          skills: editSkills,
          role: editRole,
          status: editStatus,
          centerId: editCenterId,
        }),
      });

      if (res.ok) {
        setEditingVol(null);
        fetchVolunteers();
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCreateVolunteer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/volunteers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          phone: newPhone,
          role: newRole,
          skills: newSkills,
          centerId: newCenterId || (centers[0]?.id || null),
        }),
      });

      if (res.ok) {
        setNewName('');
        setNewEmail('');
        setNewPhone('');
        setActiveTab('ROSTER');
        fetchVolunteers();
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBulkCSVImport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/volunteers/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvData: csvText,
          centerId: filterCenterId !== 'ALL' ? filterCenterId : centers[0]?.id,
        }),
      });
      const data = await res.json();
      if (data.status === 'SUCCESS') {
        setCsvMsg(`✅ ${data.message}`);
        fetchVolunteers();
        onRefresh();
      }
    } catch (err) {
      console.error(err);
      setCsvMsg('Failed to import CSV.');
    }
  };

  const handleExportCSV = () => {
    window.open('/api/volunteers?export=csv', '_blank');
  };

  // Filter volunteers
  const filteredVolunteers = volunteers.filter((v) => {
    const matchesSearch = v.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          v.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          v.skills?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCenter = filterCenterId === 'ALL' || v.centerId === filterCenterId;
    const matchesStatus = filterStatus === 'ALL' || v.status === filterStatus;
    return matchesSearch && matchesCenter && matchesStatus;
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '940px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'rgba(204, 17, 0, 0.15)', padding: '10px', borderRadius: '12px', display: 'flex' }}>
              <Users size={22} color="#CC1100" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.3rem', margin: 0 }}>Volunteer Directory & Roster Management</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                View, edit profiles, assign centers, and bulk import actual volunteer details
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={22} />
          </button>
        </div>

        {/* Tab Navigation & Export Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setActiveTab('ROSTER')}
              style={{
                background: activeTab === 'ROSTER' ? 'rgba(204, 17, 0, 0.20)' : 'transparent',
                border: activeTab === 'ROSTER' ? '1px solid rgba(204, 17, 0, 0.40)' : '1px solid transparent',
                color: activeTab === 'ROSTER' ? '#ff6b5b' : 'var(--text-secondary)',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              👥 All Volunteers ({filteredVolunteers.length})
            </button>

            <button
              onClick={() => setActiveTab('ADD_NEW')}
              style={{
                background: activeTab === 'ADD_NEW' ? 'rgba(204, 17, 0, 0.20)' : 'transparent',
                border: activeTab === 'ADD_NEW' ? '1px solid rgba(204, 17, 0, 0.40)' : '1px solid transparent',
                color: activeTab === 'ADD_NEW' ? '#ff6b5b' : 'var(--text-secondary)',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Plus size={14} /> Add Volunteer
            </button>

            <button
              onClick={() => setActiveTab('BULK_CSV')}
              style={{
                background: activeTab === 'BULK_CSV' ? 'rgba(204, 17, 0, 0.20)' : 'transparent',
                border: activeTab === 'BULK_CSV' ? '1px solid rgba(204, 17, 0, 0.40)' : '1px solid transparent',
                color: activeTab === 'BULK_CSV' ? '#ff6b5b' : 'var(--text-secondary)',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <FileSpreadsheet size={14} /> Bulk CSV Import
            </button>
          </div>

          <button className="btn btn-secondary" onClick={handleExportCSV} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
            <Download size={14} /> Export CSV
          </button>
        </div>

        {/* TAB 1: ROSTER VIEW & EDIT */}
        {activeTab === 'ROSTER' && (
          <div>
            {/* Search & Filter Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
                <input
                  type="text"
                  className="form-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, email, skills..."
                  style={{ paddingLeft: '34px' }}
                />
              </div>

              <select
                className="form-input"
                value={filterCenterId}
                onChange={(e) => setFilterCenterId(e.target.value)}
              >
                <option value="ALL">All Learning Centers</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <select
                className="form-input"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="AT_RISK">AT_RISK</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>

            {/* Volunteer Roster Table */}
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading volunteers...</div>
            ) : filteredVolunteers.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No volunteers found matching search filters.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                      <th style={{ padding: '10px 12px' }}>Volunteer Name</th>
                      <th style={{ padding: '10px 12px' }}>Contact</th>
                      <th style={{ padding: '10px 12px' }}>Role</th>
                      <th style={{ padding: '10px 12px' }}>Center</th>
                      <th style={{ padding: '10px 12px' }}>Status</th>
                      <th style={{ padding: '10px 12px' }}>Hours</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVolunteers.map((vol) => (
                      <tr key={vol.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}>
                        <td style={{ padding: '12px' }}>
                          <div style={{ fontWeight: 600, color: '#fff' }}>{vol.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{vol.skills}</div>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <div style={{ color: 'var(--text-secondary)' }}>{vol.email}</div>
                          <div style={{ fontSize: '0.75rem', color: '#25d366' }}>📱 {vol.phone || vol.whatsappPhone || 'N/A'}</div>
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: vol.role === 'CHAPTER_LEADER' ? 'rgba(168, 85, 247, 0.15)' : vol.role === 'COORDINATOR' ? 'rgba(204, 17, 0, 0.15)' : 'rgba(255,255,255,0.06)',
                            color: vol.role === 'CHAPTER_LEADER' ? '#c084fc' : vol.role === 'COORDINATOR' ? '#ff6b5b' : 'var(--text-secondary)'
                          }}>
                            {vol.role === 'COORDINATOR' ? 'Centre Leader' : vol.role === 'CHAPTER_LEADER' ? 'Chapter Leader' : 'Volunteer'}
                          </span>
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                          {vol.center?.name || 'Unassigned'}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span className={`badge badge-${vol.status.toLowerCase().replace('_', '-')}`}>
                            {vol.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px', fontWeight: 600, color: '#fff' }}>
                          {vol.totalHours || 0} hrs
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleOpenEdit(vol)}
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          >
                            <Edit2 size={13} /> Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ADD SINGLE VOLUNTEER */}
        {activeTab === 'ADD_NEW' && (
          <form onSubmit={handleCreateVolunteer} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '540px', margin: '0 auto' }}>
            <h4 style={{ fontSize: '1.05rem', marginBottom: '8px' }}>Onboard New Volunteer</h4>
            
            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Full Name</label>
              <input
                type="text"
                className="form-input"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Email Address</label>
              <input
                type="email"
                className="form-input"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="e.g. rahul@example.com"
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>WhatsApp Mobile Number</label>
              <input
                type="text"
                className="form-input"
                required
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="e.g. +91 98765 43210"
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Role</label>
              <select className="form-input" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                <option value="VOLUNTEER">Field Volunteer</option>
                <option value="COORDINATOR">Centre Leader</option>
                <option value="CHAPTER_LEADER">Chapter Leader</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Center Assignment</label>
              <select className="form-input" value={newCenterId} onChange={(e) => setNewCenterId(e.target.value)}>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Skills & Subjects</label>
              <input
                type="text"
                className="form-input"
                value={newSkills}
                onChange={(e) => setNewSkills(e.target.value)}
                placeholder="e.g. Mathematics, English, Art"
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', marginTop: '10px' }}>
              <Check size={16} /> Save & Onboard Volunteer
            </button>
          </form>
        )}

        {/* TAB 3: BULK CSV UPLOAD */}
        {activeTab === 'BULK_CSV' && (
          <form onSubmit={handleBulkCSVImport} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h4 style={{ fontSize: '1.05rem', margin: 0 }}>Bulk Upload Volunteer CSV</h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
              Paste or edit CSV rows to onboard/update an entire roster in 5 seconds.
            </p>

            <textarea
              className="form-input"
              rows={8}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}
            />

            {csvMsg && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontSize: '0.85rem' }}>
                {csvMsg}
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center' }}>
              <FileSpreadsheet size={16} /> Process & Upload Roster
            </button>
          </form>
        )}

        {/* EDIT VOLUNTEER MODAL OVERLAY */}
        {editingVol && (
          <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={() => setEditingVol(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h4 style={{ fontSize: '1.15rem', margin: 0 }}>Edit Volunteer: {editingVol.name}</h4>
                <button onClick={() => setEditingVol(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Email</label>
                  <input
                    type="email"
                    className="form-input"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>WhatsApp Mobile Number</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Role</label>
                  <select className="form-input" value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                    <option value="VOLUNTEER">Field Volunteer</option>
                    <option value="COORDINATOR">Centre Leader</option>
                    <option value="CHAPTER_LEADER">Chapter Leader</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Status</label>
                  <select className="form-input" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="AT_RISK">AT_RISK</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Center Assignment</label>
                  <select className="form-input" value={editCenterId} onChange={(e) => setEditCenterId(e.target.value)}>
                    <option value="">Unassigned</option>
                    {centers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Skills & Subjects</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editSkills}
                    onChange={(e) => setEditSkills(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button type="submit" className="btn btn-primary" disabled={savingEdit} style={{ flex: 1, justifyContent: 'center' }}>
                    <Save size={15} /> Save Changes
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditingVol(null)}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
