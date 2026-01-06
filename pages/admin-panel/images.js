import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin-panel/AdminLayout';

export default function ImagesPage() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchSlots();
  }, []);

  const fetchSlots = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin-panel/images', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      
      const slotsArray = data.slots || [];
      const normalized = [1, 2, 3].map(num => {
        const existing = slotsArray.find(s => s.slot_number === num);
        return existing || { slot_number: num, image_url: '', link_url: '', alt_text: '', is_active: true };
      });
      
      setSlots(normalized);
    } catch (error) {
      console.error('Error fetching slots:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (slotNumber) => {
    const slot = slots.find(s => s.slot_number === slotNumber);
    if (!slot) return;

    setSaving(prev => ({ ...prev, [slotNumber]: true }));
    setMessage(null);

    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin-panel/images', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          slotNumber: slot.slot_number,
          imageUrl: slot.image_url,
          linkUrl: slot.link_url,
          altText: slot.alt_text,
          isActive: slot.is_active
        })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: `Ad Slot ${slotNumber} saved successfully` });
        fetchSlots();
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to save' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save ad slot' });
    } finally {
      setSaving(prev => ({ ...prev, [slotNumber]: false }));
    }
  };

  const handleClear = (slotNumber) => {
    setSlots(prev => prev.map(s => 
      s.slot_number === slotNumber 
        ? { ...s, image_url: '', link_url: '', alt_text: '' }
        : s
    ));
  };

  const updateSlot = (slotNumber, field, value) => {
    setSlots(prev => prev.map(s =>
      s.slot_number === slotNumber ? { ...s, [field]: value } : s
    ));
  };

  if (loading) {
    return (
      <AdminLayout title="Images" requiredPermission="settings">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Images" requiredPermission="settings">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Ad Images</h1>
            <p className="text-gray-400 text-sm mt-1">
              Manage banner carousel ad slots. Recommended size: 864 x 180 pixels
            </p>
          </div>
        </div>

        {message && (
          <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {message.text}
          </div>
        )}

        <div className="grid gap-6">
          {slots.map((slot) => (
            <div key={slot.slot_number} className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Ad Slot {slot.slot_number}</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-sm text-gray-400">Active</span>
                  <input
                    type="checkbox"
                    checked={slot.is_active}
                    onChange={(e) => updateSlot(slot.slot_number, 'is_active', e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-500 focus:ring-purple-500"
                  />
                </label>
              </div>

              <div className="mb-4">
                <div className="bg-black/30 rounded-lg overflow-hidden" style={{ height: '180px' }}>
                  {slot.image_url ? (
                    <img 
                      src={slot.image_url} 
                      alt={slot.alt_text || 'Preview'} 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div 
                    className={`w-full h-full flex flex-col items-center justify-center text-gray-500 ${slot.image_url ? 'hidden' : ''}`}
                  >
                    <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm">No image set</span>
                    <span className="text-xs mt-1">864 x 180 recommended</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Image URL</label>
                  <input
                    type="url"
                    value={slot.image_url || ''}
                    onChange={(e) => updateSlot(slot.slot_number, 'image_url', e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-4 py-2 bg-black/30 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Link URL (optional)</label>
                  <input
                    type="url"
                    value={slot.link_url || ''}
                    onChange={(e) => updateSlot(slot.slot_number, 'link_url', e.target.value)}
                    placeholder="https://example.com/promo"
                    className="w-full px-4 py-2 bg-black/30 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Alt Text (optional)</label>
                  <input
                    type="text"
                    value={slot.alt_text || ''}
                    onChange={(e) => updateSlot(slot.slot_number, 'alt_text', e.target.value)}
                    placeholder="Promotion description"
                    className="w-full px-4 py-2 bg-black/30 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => handleSave(slot.slot_number)}
                    disabled={saving[slot.slot_number]}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                  >
                    {saving[slot.slot_number] ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => handleClear(slot.slot_number)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                  >
                    Clear
                  </button>
                </div>

                {slot.updated_at && (
                  <p className="text-xs text-gray-500">
                    Last updated: {new Date(slot.updated_at).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <h4 className="font-semibold text-blue-400 mb-2">Image Guidelines</h4>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>Recommended size: <strong>864 x 180 pixels</strong></li>
            <li>Mobile display: Images scale to fit screen width</li>
            <li>Supported formats: JPG, PNG, WebP, GIF</li>
            <li>Use external image hosting (Cloudinary, Imgur, etc.)</li>
          </ul>
        </div>
      </div>
    </AdminLayout>
  );
}
