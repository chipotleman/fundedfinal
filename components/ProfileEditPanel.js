import { useEffect, useRef, useState } from 'react';
import UserAvatar from './UserAvatar';
import { TEAM_CATALOG, FAVORITE_TEAMS_LIMIT, BANNER_LIBRARY } from '../lib/teamCatalog';

const BIO_MAX = 200;

/**
 * Editable profile panel — banner, avatar, username, bio, favorite teams, equipped frame.
 *
 * Props:
 *  - profile: current profile object (with frames, favoriteTeams, etc.)
 *  - formData / setFormData: form state
 *  - usernameStatus, onUsernameChange: username availability
 *  - onSave, onCancel, saving
 *  - isDarkMode
 */
export default function ProfileEditPanel({
  profile,
  formData,
  setFormData,
  usernameStatus,
  onUsernameChange,
  onSave,
  onCancel,
  saving,
  isDarkMode,
}) {
  const avatarInputRef = useRef(null);
  const bannerInputRef = useRef(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [activeLeague, setActiveLeague] = useState(TEAM_CATALOG[0].league);

  const inputBg = isDarkMode ? '#111' : '#f3f4f6';
  const inputBorder = isDarkMode ? '#1a1a1a' : '#e5e7eb';
  const inputText = isDarkMode ? 'text-white' : 'text-gray-900';
  const labelClass = 'block text-xs text-gray-500 mb-1 uppercase tracking-wider';

  const frames = Array.isArray(profile?.frames) ? profile.frames : [];
  const favorites = Array.isArray(formData.favoriteTeams) ? formData.favoriteTeams : [];

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be less than 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setFormData({ ...formData, avatar: reader.result });
    reader.readAsDataURL(file);
  };

  const handleBannerUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      alert('Banner must be less than 4MB');
      return;
    }
    setBannerUploading(true);
    try {
      const urlRes = await fetch('/api/uploads/request-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (urlRes.ok) {
        const { uploadURL, objectPath } = await urlRes.json();
        const up = await fetch(uploadURL, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        });
        if (up.ok) {
          setFormData({ ...formData, bannerUrl: objectPath });
          return;
        }
      }
      // Fallback to data URL
      const reader = new FileReader();
      reader.onloadend = () => setFormData({ ...formData, bannerUrl: reader.result });
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Banner upload failed', err);
      const reader = new FileReader();
      reader.onloadend = () => setFormData({ ...formData, bannerUrl: reader.result });
      reader.readAsDataURL(file);
    } finally {
      setBannerUploading(false);
    }
  };

  const toggleTeam = (league, teamId) => {
    const exists = favorites.some((t) => t.league === league && t.teamId === teamId);
    if (exists) {
      setFormData({
        ...formData,
        favoriteTeams: favorites.filter((t) => !(t.league === league && t.teamId === teamId)),
      });
    } else {
      if (favorites.length >= FAVORITE_TEAMS_LIMIT) {
        alert(`You can pick up to ${FAVORITE_TEAMS_LIMIT} favorite teams.`);
        return;
      }
      setFormData({ ...formData, favoriteTeams: [...favorites, { league, teamId }] });
    }
  };

  const selectFrame = (frameId, unlocked) => {
    if (!unlocked) return;
    const next = formData.equippedFrame === frameId ? null : frameId;
    setFormData({ ...formData, equippedFrame: next });
  };

  const activeGroup = TEAM_CATALOG.find((g) => g.league === activeLeague) || TEAM_CATALOG[0];

  return (
    <div className="space-y-5">
      {/* Banner */}
      <div>
        <label className={labelClass}>Banner</label>
        <div
          className="relative w-full rounded-lg overflow-hidden mb-2"
          style={{
            height: '120px',
            backgroundColor: inputBg,
            border: `1px solid ${inputBorder}`,
          }}
        >
          {formData.bannerUrl ? (
            <img src={formData.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
              No banner selected
            </div>
          )}
          {formData.bannerUrl && (
            <button
              type="button"
              onClick={() => setFormData({ ...formData, bannerUrl: '' })}
              className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded"
            >
              Remove
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mb-2">
          {BANNER_LIBRARY.map((b) => {
            const selected = formData.bannerUrl === b.url;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setFormData({ ...formData, bannerUrl: b.url })}
                className="rounded-md overflow-hidden"
                style={{
                  width: '88px',
                  height: '44px',
                  border: `2px solid ${selected ? '#3b82f6' : inputBorder}`,
                }}
                title={b.name}
              >
                <img src={b.url} alt={b.name} className="w-full h-full object-cover" />
              </button>
            );
          })}
        </div>
        <input
          ref={bannerInputRef}
          type="file"
          accept="image/*"
          onChange={handleBannerUpload}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => bannerInputRef.current?.click()}
          disabled={bannerUploading}
          className="text-xs font-medium px-3 py-1.5 rounded-md"
          style={{ backgroundColor: inputBg, border: `1px solid ${inputBorder}`, color: isDarkMode ? '#d1d5db' : '#374151' }}
        >
          {bannerUploading ? 'Uploading…' : 'Upload custom banner'}
        </button>
      </div>

      {/* Avatar + Username */}
      <div className="flex gap-4 items-start">
        <div>
          <label className={labelClass}>Avatar</label>
          <label className="cursor-pointer block">
            <UserAvatar
              avatar={formData.avatar}
              username={formData.username || profile?.username}
              frameId={formData.equippedFrame}
              size={72}
              bgColor={inputBg}
              textColor={isDarkMode ? '#fff' : '#374151'}
            />
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
              ref={avatarInputRef}
            />
            <div className="text-[10px] text-gray-500 mt-1 text-center">Tap to change</div>
          </label>
        </div>
        <div className="flex-1">
          <label className={labelClass}>Username</label>
          <input
            type="text"
            value={formData.username}
            onChange={onUsernameChange}
            className={`w-full rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 ${inputText}`}
            style={{ backgroundColor: inputBg, border: `1px solid ${inputBorder}`, fontSize: '16px' }}
            maxLength={20}
          />
          {usernameStatus?.checking && <p className="text-gray-400 text-xs mt-1">Checking…</p>}
          {usernameStatus?.available === true && formData.username !== profile?.username && (
            <p className="text-green-400 text-xs mt-1">Available</p>
          )}
          {usernameStatus?.error && <p className="text-red-400 text-xs mt-1">{usernameStatus.error}</p>}
        </div>
      </div>

      {/* Bio */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={labelClass + ' mb-0'}>Bio</label>
          <span className="text-[10px] text-gray-500">
            {(formData.bio || '').length}/{BIO_MAX}
          </span>
        </div>
        <textarea
          value={formData.bio}
          onChange={(e) => setFormData({ ...formData, bio: e.target.value.slice(0, BIO_MAX) })}
          className={`w-full rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 ${inputText}`}
          style={{ backgroundColor: inputBg, border: `1px solid ${inputBorder}`, fontSize: '16px' }}
          rows={3}
          maxLength={BIO_MAX}
          placeholder="Tell others about yourself…"
        />
      </div>

      {/* Favorite Teams */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={labelClass + ' mb-0'}>
            Favorite teams
          </label>
          <span className="text-[10px] text-gray-500">
            {favorites.length}/{FAVORITE_TEAMS_LIMIT}
          </span>
        </div>
        <div className="flex flex-wrap gap-1 mb-2">
          {TEAM_CATALOG.map((g) => (
            <button
              key={g.league}
              type="button"
              onClick={() => setActiveLeague(g.league)}
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{
                backgroundColor: activeLeague === g.league ? '#3b82f6' : inputBg,
                color: activeLeague === g.league ? '#fff' : isDarkMode ? '#d1d5db' : '#374151',
                border: `1px solid ${activeLeague === g.league ? '#3b82f6' : inputBorder}`,
              }}
            >
              {g.league}
            </button>
          ))}
        </div>
        <div
          className="rounded-lg p-2 max-h-44 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-1"
          style={{ backgroundColor: inputBg, border: `1px solid ${inputBorder}` }}
        >
          {activeGroup.teams.map((t) => {
            const selected = favorites.some(
              (f) => f.league === activeGroup.league && f.teamId === t.id
            );
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTeam(activeGroup.league, t.id)}
                className="flex items-center gap-2 text-left px-2 py-1.5 rounded-md text-xs"
                style={{
                  backgroundColor: selected ? '#3b82f6' : 'transparent',
                  color: selected ? '#fff' : isDarkMode ? '#e5e7eb' : '#374151',
                }}
              >
                {t.logo ? (
                  <img src={t.logo} alt="" className="w-5 h-5 object-contain" />
                ) : (
                  <span
                    className="w-5 h-5 inline-flex items-center justify-center rounded-full text-[10px] font-bold"
                    style={{
                      backgroundColor: selected ? 'rgba(255,255,255,0.2)' : inputBorder,
                      color: selected ? '#fff' : isDarkMode ? '#fff' : '#374151',
                    }}
                  >
                    {t.id}
                  </span>
                )}
                <span className="truncate">{t.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Frames */}
      <div>
        <label className={labelClass}>Avatar frame</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setFormData({ ...formData, equippedFrame: null })}
            className="rounded-lg p-2 text-xs flex items-center gap-2"
            style={{
              backgroundColor: !formData.equippedFrame ? '#3b82f6' : inputBg,
              color: !formData.equippedFrame ? '#fff' : isDarkMode ? '#d1d5db' : '#374151',
              border: `1px solid ${!formData.equippedFrame ? '#3b82f6' : inputBorder}`,
            }}
          >
            <UserAvatar
              avatar={formData.avatar}
              username={formData.username || profile?.username}
              size={32}
              bgColor={inputBg}
              textColor={isDarkMode ? '#fff' : '#374151'}
            />
            <span>No frame</span>
          </button>
          {frames.map((f) => {
            const isEquipped = formData.equippedFrame === f.id;
            return (
              <button
                key={f.id}
                type="button"
                disabled={!f.unlocked}
                onClick={() => selectFrame(f.id, f.unlocked)}
                className="rounded-lg p-2 text-xs flex items-center gap-2"
                style={{
                  backgroundColor: isEquipped ? '#3b82f6' : inputBg,
                  color: isEquipped ? '#fff' : isDarkMode ? '#d1d5db' : '#374151',
                  border: `1px solid ${isEquipped ? '#3b82f6' : inputBorder}`,
                  opacity: f.unlocked ? 1 : 0.55,
                  cursor: f.unlocked ? 'pointer' : 'not-allowed',
                }}
                title={f.unlocked ? f.description : 'Locked — earn the matching achievement'}
              >
                <UserAvatar
                  avatar={formData.avatar}
                  username={formData.username || profile?.username}
                  frame={f}
                  size={32}
                  bgColor={inputBg}
                  textColor={isDarkMode ? '#fff' : '#374151'}
                />
                <span className="flex-1 min-w-0 truncate">
                  <span className="block truncate font-semibold">{f.name}</span>
                  <span className="block text-[10px] opacity-80">
                    {f.unlocked ? f.rarity : 'Locked'}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <button
          onClick={onSave}
          disabled={saving || usernameStatus?.available === false}
          className="bg-blue-600 disabled:opacity-40 text-white font-bold py-2 px-6 rounded-lg text-sm"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          className={`font-semibold py-2 px-6 rounded-lg text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}
          style={{ backgroundColor: inputBg, border: `1px solid ${inputBorder}` }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
