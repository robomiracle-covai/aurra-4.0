import React, { useState, useEffect } from 'react';
import { 
  X, 
  Shield, 
  Layers, 
  Image as ImageIcon, 
  Mic, 
  MicOff, 
  Eye, 
  EyeOff, 
  Plus, 
  Trash2, 
  RotateCcw, 
  Check, 
  Edit2, 
  Save 
} from 'lucide-react';
import { offlineCardService, offlineSliderService, offlineBrandingService } from '../db/offlineServices';
import { logger } from '../services/logger';
import ImageGalleryModal from './ImageGalleryModal';
import './AdminDrawer.css';

export default function AdminDrawer({ isOpen, onClose, onRefreshData }) {
  const [activeTab, setActiveTab] = useState('cards'); // 'cards' | 'slides' | 'branding'
  const [cards, setCards] = useState([]);
  const [slides, setSlides] = useState([]);
  const [headerTitle, setHeaderTitle] = useState('');
  const [isSavingHeader, setIsSavingHeader] = useState(false);
  const [newSlideTitle, setNewSlideTitle] = useState('');
  const [newSlideSubtitle, setNewSlideSubtitle] = useState('');
  const [newSlideUrl, setNewSlideUrl] = useState('');
  const [isSlideGalleryOpen, setIsSlideGalleryOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadAllAdminData();
    }
  }, [isOpen]);

  const showStatus = (msg) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 3000);
  };

  const loadAllAdminData = async () => {
    try {
      const loadedCards = await offlineCardService.getCards();
      setCards(loadedCards || []);

      const loadedSlides = await offlineSliderService.getSlideImages();
      setSlides(loadedSlides || []);

      const header = await offlineBrandingService.getHeader();
      setHeaderTitle((header?.headerName && header.headerName !== 'Robomiracle Technologies Private Limited') ? header.headerName.replace(/\s*4\.0/gi, '').trim() : 'AURRA');
    } catch (err) {
      logger.error('ADMIN', `Failed to load admin data: ${err.message}`);
    }
  };

  // ── Cards Handlers ──
  const handleToggleCardEnabled = async (card) => {
    const updated = !card.isEnabled;
    await offlineCardService.toggleCardEnabled(card.id, updated);
    setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, isEnabled: updated } : c)));
    window.dispatchEvent(new CustomEvent('aurra_cards_changed'));
    logger.info('ADMIN', `Card [${card.title}] display visibility set to: ${updated}`);
    showStatus(`Updated visibility for ${card.title}`);
    onRefreshData?.();
  };

  const handleToggleVoiceAccess = async (card) => {
    const updated = card.voiceAccessEnabled === false ? true : false;
    await offlineCardService.toggleVoiceAccess(card.id, updated);
    setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, voiceAccessEnabled: updated } : c)));
    window.dispatchEvent(new CustomEvent('aurra_cards_changed'));
    logger.speech('ADMIN', `Card [${card.title}] VOICE ACCESS set to: ${updated ? 'ALLOWED' : 'BLOCKED'}`);
    showStatus(`Voice access for "${card.title}" set to ${updated ? 'ON' : 'OFF'}`);
    onRefreshData?.();
  };

  const handleRestoreDefaultCards = async () => {
    if (window.confirm('Reset all action cards to default system state?')) {
      const reset = await offlineCardService.restoreDefaultCards();
      setCards(reset);
      window.dispatchEvent(new CustomEvent('aurra_cards_changed'));
      logger.info('ADMIN', 'Restored default action cards');
      showStatus('Cards restored to default');
      onRefreshData?.();
    }
  };

  // ── Slider Handlers ──
  const handleToggleSlideSelected = async (slide) => {
    const updated = !slide.isSelected;
    await offlineSliderService.toggleSlideSelected(slide.id, updated);
    setSlides((prev) => prev.map((s) => (s.id === slide.id ? { ...s, isSelected: updated } : s)));
    window.dispatchEvent(new CustomEvent('aurra_slides_changed'));
    logger.info('ADMIN', `Slide [${slide.title}] active state set to: ${updated}`);
    onRefreshData?.();
  };

  const handleDeleteSlide = async (slideId) => {
    await offlineSliderService.deleteSlideImage(slideId);
    setSlides((prev) => prev.filter((s) => s.id !== slideId));
    logger.info('ADMIN', `Deleted slide ID: ${slideId}`);
    showStatus('Slide removed');
    onRefreshData?.();
  };

  const handleAddSlide = async (e) => {
    e.preventDefault();
    if (!newSlideTitle.trim()) return;

    await offlineSliderService.addSlideImage({
      title: newSlideTitle.trim(),
      subtitle: newSlideSubtitle.trim(),
      url: newSlideUrl.trim(),
      isSelected: true,
    });

    setNewSlideTitle('');
    setNewSlideSubtitle('');
    setNewSlideUrl('');
    const updated = await offlineSliderService.getSlideImages();
    setSlides(updated);
    logger.info('ADMIN', `Added new slide: ${newSlideTitle}`);
    showStatus('New banner slide added');
    onRefreshData?.();
  };

  const handleRestoreDefaultSlides = async () => {
    if (window.confirm('Reset slideshow banners to defaults?')) {
      const reset = await offlineSliderService.restoreDefaultSlides();
      setSlides(reset);
      logger.info('ADMIN', 'Restored default slides');
      showStatus('Slides restored to defaults');
      onRefreshData?.();
    }
  };

  // ── Branding Handlers ──
  const handleSaveHeader = async () => {
    setIsSavingHeader(true);
    try {
      await offlineBrandingService.saveHeader(headerTitle.trim());
      logger.info('ADMIN', `Header title updated to: "${headerTitle.trim()}"`);
      showStatus('Header branding saved');
      onRefreshData?.();
    } finally {
      setIsSavingHeader(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="admin-overlay" onClick={onClose}>
      <div className="admin-drawer" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="admin-header">
          <div className="admin-title-row">
            <div className="admin-icon-glow">
              <Shield size={22} color="#00FFFF" />
            </div>
            <div>
              <h2>AURRA KIOSK CONFIGURATION</h2>
              <span className="admin-subtitle">Feature Permissions & Slideshow Management</span>
            </div>
          </div>
          <button className="admin-close-btn" onClick={onClose} aria-label="Close Admin Drawer">
            <X size={20} />
          </button>
        </div>

        {/* Status Notification Toast */}
        {statusMsg && (
          <div className="admin-toast">
            <Check size={16} />
            <span>{statusMsg}</span>
          </div>
        )}

        {/* Tabs Bar */}
        <div className="admin-tabs">
          <button
            className={`admin-tab-btn ${activeTab === 'cards' ? 'active' : ''}`}
            onClick={() => setActiveTab('cards')}
          >
            <Layers size={16} />
            <span>Action Cards & Voice Access</span>
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'slides' ? 'active' : ''}`}
            onClick={() => setActiveTab('slides')}
          >
            <ImageIcon size={16} />
            <span>Banner Slideshow</span>
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'branding' ? 'active' : ''}`}
            onClick={() => setActiveTab('branding')}
          >
            <Edit2 size={16} />
            <span>Header Branding</span>
          </button>
        </div>

        {/* Drawer Body Content */}
        <div className="admin-body">
          {/* TAB 1: CARDS & VOICE ACCESS */}
          {activeTab === 'cards' && (
            <div className="admin-section">
              <div className="section-header-row">
                <div>
                  <h3>Feature Cards & Voice Control Matrix</h3>
                  <p>Toggle card visibility on home screen, or toggle voice access permissions.</p>
                </div>
                <button className="admin-action-btn secondary" onClick={handleRestoreDefaultCards}>
                  <RotateCcw size={14} />
                  <span>Reset Defaults</span>
                </button>
              </div>

              <div className="admin-cards-list">
                {cards.map((card) => {
                  const isVoiceOn = card.voiceAccessEnabled !== false;
                  const isVisible = card.isEnabled !== false;

                  return (
                    <div key={card.id} className={`admin-card-row ${!isVisible ? 'dimmed' : ''}`}>
                      <div className="card-info-col">
                        <div className="card-title-line">
                          <span className="card-num">#{card.id}</span>
                          <strong>{card.title}</strong>
                          <span className="card-route-tag">{card.href}</span>
                        </div>
                        <p className="card-subtitle-line">{card.subtitle}</p>
                        <div className="keywords-wrap">
                          <span className="kw-label">Voice keywords:</span>
                          {(card.voiceKeywords || []).map((kw, i) => (
                            <span key={i} className="kw-badge">"{kw}"</span>
                          ))}
                        </div>
                      </div>

                      <div className="card-toggles-col">
                        {/* Voice Access Toggle */}
                        <div className="toggle-group">
                          <span className="toggle-label">Voice Access:</span>
                          <button
                            className={`toggle-switch ${isVoiceOn ? 'on' : 'off'}`}
                            onClick={() => handleToggleVoiceAccess(card)}
                            title={isVoiceOn ? 'Voice access ALLOWED' : 'Voice access BLOCKED'}
                          >
                            {isVoiceOn ? <Mic size={14} /> : <MicOff size={14} />}
                            <span>{isVoiceOn ? 'ALLOWED' : 'BLOCKED'}</span>
                          </button>
                        </div>

                        {/* Display Visibility Toggle */}
                        <div className="toggle-group">
                          <span className="toggle-label">Display Card:</span>
                          <button
                            className={`toggle-switch ${isVisible ? 'on' : 'off'}`}
                            onClick={() => handleToggleCardEnabled(card)}
                            title={isVisible ? 'Card visible' : 'Card hidden'}
                          >
                            {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                            <span>{isVisible ? 'SHOWN' : 'HIDDEN'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: SLIDESHOW */}
          {activeTab === 'slides' && (
            <div className="admin-section">
              <div className="section-header-row">
                <div>
                  <h3>Slideshow Banners</h3>
                  <p>Configure the high-resolution banners rotating on the kiosk home screen.</p>
                </div>
                <button className="admin-action-btn secondary" onClick={handleRestoreDefaultSlides}>
                  <RotateCcw size={14} />
                  <span>Restore Defaults</span>
                </button>
              </div>

              {/* Add New Slide Form */}
              <form className="add-slide-form" onSubmit={handleAddSlide}>
                <h4>Add New Slide</h4>
                <div className="form-grid">
                  <input
                    type="text"
                    placeholder="Slide Title (e.g. Robot Tour)"
                    value={newSlideTitle}
                    onChange={(e) => setNewSlideTitle(e.target.value)}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Subtitle (e.g. Discover our advanced features)"
                    value={newSlideSubtitle}
                    onChange={(e) => setNewSlideSubtitle(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Image URL or choose from gallery"
                      value={newSlideUrl}
                      onChange={(e) => setNewSlideUrl(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="admin-action-btn secondary"
                      onClick={() => setIsSlideGalleryOpen(true)}
                      style={{ padding: '0 12px', whiteSpace: 'nowrap' }}
                      title="Select from Gallery"
                    >
                      <ImageIcon size={14} />
                      <span>Gallery</span>
                    </button>
                  </div>
                </div>
                <button type="submit" className="admin-action-btn primary">
                  <Plus size={14} />
                  <span>Add Slide</span>
                </button>
              </form>

              {/* Slides List */}
              <div className="admin-slides-list">
                {slides.map((slide, idx) => (
                  <div key={slide.id || idx} className="admin-slide-row">
                    <div className="slide-preview-thumb">
                      {slide.url ? (
                        <img src={slide.url} alt={slide.title} onError={(e) => { e.target.style.display = 'none'; }} />
                      ) : (
                        <div className="neon-thumb-placeholder">SLIDE {idx + 1}</div>
                      )}
                    </div>
                    <div className="slide-info-col">
                      <strong>{slide.title}</strong>
                      <p>{slide.subtitle || 'Cyber aesthetic banner'}</p>
                      {slide.url && <span className="slide-url-text">{slide.url}</span>}
                    </div>
                    <div className="slide-actions-col">
                      <button
                        className={`toggle-switch ${slide.isSelected !== false ? 'on' : 'off'}`}
                        onClick={() => handleToggleSlideSelected(slide)}
                      >
                        {slide.isSelected !== false ? <Eye size={14} /> : <EyeOff size={14} />}
                        <span>{slide.isSelected !== false ? 'ACTIVE' : 'INACTIVE'}</span>
                      </button>
                      <button
                        className="delete-btn"
                        onClick={() => handleDeleteSlide(slide.id)}
                        title="Delete Slide"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: BRANDING */}
          {activeTab === 'branding' && (
            <div className="admin-section">
              <h3>Kiosk Branding & Header</h3>
              <p>Customize the top organizational banner displayed across all kiosk views.</p>
              
              <div className="branding-form">
                <label>Header Title</label>
                <div className="branding-input-row">
                  <input
                    type="text"
                    value={headerTitle}
                    onChange={(e) => setHeaderTitle(e.target.value)}
                    placeholder="e.g. AURRA 4.0"
                  />
                  <button 
                    className="admin-action-btn primary" 
                    onClick={handleSaveHeader}
                    disabled={isSavingHeader}
                  >
                    <Save size={16} />
                    <span>Save Header</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ImageGalleryModal
        isOpen={isSlideGalleryOpen}
        onClose={() => setIsSlideGalleryOpen(false)}
        onSelectImage={(path) => setNewSlideUrl(path)}
        currentPath={newSlideUrl}
        title="Select Banner Slide Image"
      />
    </div>
  );
}
