import { useState, useEffect, useRef } from 'react';
import AdminLayout from '../../components/admin-panel/AdminLayout';

export default function ImagesPage() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [uploading, setUploading] = useState({});
  const [message, setMessage] = useState(null);
  const desktopFileRefs = useRef({});
  const mobileFileRefs = useRef({});

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
        return existing || { slot_number: num, image_url: '', mobile_image_url: '', link_url: '', alt_text: '', is_active: true };
      });
      
      setSlots(normalized);
    } catch (error) {
      console.error('Error fetching slots:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (slotNumber, file, type) => {
    if (!file) return;

    const uploadKey = `${slotNumber}-${type}`;
    setUploading(prev => ({ ...prev, [uploadKey]: true }));
    setMessage(null);

    try {
      const token = localStorage.getItem('admin_token');
      
      const urlRes = await fetch('/api/admin-panel/upload-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: file.name,
          contentType: file.type || 'image/jpeg'
        })
      });

      if (!urlRes.ok) {
        const error = await urlRes.json();
        throw new Error(error.error || 'Failed to get upload URL');
      }

      const { uploadURL, publicURL } = await urlRes.json();

      const uploadRes = await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type || 'image/jpeg'
        }
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload file');
      }

      const field = type === 'desktop' ? 'image_url' : 'mobile_image_url';
      updateSlot(slotNumber, field, publicURL);
      setMessage({ type: 'success', text: `${type === 'desktop' ? 'Desktop' : 'Mobile'} image uploaded for Slot ${slotNumber}. Click Save to apply.` });
    } catch (error) {
      console.error('Upload error:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to upload image' });
    } finally {
      setUploading(prev => ({ ...prev, [uploadKey]: false }));
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
          mobileImageUrl: slot.mobile_image_url,
          linkUrl: slot.link_url,
          altText: slot.alt_text,
          isActive: slot.is_active
        })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: `Ad Slot ${slotNumber} saved successfully` });
        fetchSlots();
      } else if (res.status === 403) {
        setMessage({ type: 'error', text: 'You do not have permission to modify ad slots' });
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
        ? { ...s, image_url: '', mobile_image_url: '', link_url: '', alt_text: '' }
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
      <AdminLayout title="Images" requiredPermission="settings:write">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Images" requiredPermission="settings:write">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Ad Images</h1>
            <p className="text-gray-400 text-sm mt-1">
              Manage banner carousel ad slots with separate desktop and mobile images
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

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-300">Desktop (864 x 180)</span>
                  </div>
                  <div className="bg-black/30 rounded-lg overflow-hidden relative" style={{ height: '120px' }}>
                    {slot.image_url ? (
                      <img 
                        src={slot.image_url} 
                        alt="Desktop preview" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                        <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs">No desktop image</span>
                      </div>
                    )}
                    {uploading[`${slot.slot_number}-desktop`] && (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-purple-500"></div>
                      </div>
                    )}
                  </div>
                  <div className="mt-2">
                    <input
                      ref={el => desktopFileRefs.current[slot.slot_number] = el}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(slot.slot_number, file, 'desktop');
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                    <button
                      onClick={() => desktopFileRefs.current[slot.slot_number]?.click()}
                      disabled={uploading[`${slot.slot_number}-desktop`]}
                      className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Upload Desktop
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-300">Mobile (343 x 140)</span>
                  </div>
                  <div className="bg-black/30 rounded-lg overflow-hidden relative" style={{ height: '120px' }}>
                    {slot.mobile_image_url ? (
                      <img 
                        src={slot.mobile_image_url} 
                        alt="Mobile preview" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                        <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs">No mobile image</span>
                      </div>
                    )}
                    {uploading[`${slot.slot_number}-mobile`] && (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-purple-500"></div>
                      </div>
                    )}
                  </div>
                  <div className="mt-2">
                    <input
                      ref={el => mobileFileRefs.current[slot.slot_number] = el}
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload(slot.slot_number, file, 'mobile');
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                    <button
                      onClick={() => mobileFileRefs.current[slot.slot_number]?.click()}
                      disabled={uploading[`${slot.slot_number}-mobile`]}
                      className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Upload Mobile
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t border-white/10 pt-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Desktop Image URL</label>
                    <input
                      type="url"
                      value={slot.image_url || ''}
                      onChange={(e) => updateSlot(slot.slot_number, 'image_url', e.target.value)}
                      placeholder="https://example.com/desktop.jpg"
                      className="w-full px-4 py-2 bg-black/30 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Mobile Image URL</label>
                    <input
                      type="url"
                      value={slot.mobile_image_url || ''}
                      onChange={(e) => updateSlot(slot.slot_number, 'mobile_image_url', e.target.value)}
                      placeholder="https://example.com/mobile.jpg"
                      className="w-full px-4 py-2 bg-black/30 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 text-sm"
                    />
                  </div>
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
                    Clear All
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
          <h4 className="font-semibold text-blue-400 mb-2">Image Size Guidelines</h4>
          <ul className="text-sm text-gray-300 space-y-1">
            <li><strong>Desktop:</strong> 864 x 180 pixels (landscape banner)</li>
            <li><strong>Mobile:</strong> 343 x 140 pixels (optimized for phone screens)</li>
            <li>Supported formats: JPG, PNG, WebP, GIF</li>
            <li>If only one image is uploaded, it will be used for both sizes</li>
          </ul>
        </div>
      </div>
    </AdminLayout>
  );
}
