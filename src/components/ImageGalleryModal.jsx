import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Search,
  Check,
  Upload,
  Sparkles,
  Bot,
  Cpu,
  Gauge,
  Smile,
  Activity,
  Heart,
  Layers,
  Image as ImageIcon,
  ExternalLink,
  RotateCcw,
  CheckCircle2,
  Filter
} from 'lucide-react';
import {
  GALLERY_CATEGORIES,
  GALLERY_ASSETS,
  filterGalleryAssets,
  findAssetByPath
} from '../data/galleryAssets';
import { assetUrl } from '../utils/platform';
import './ImageGalleryModal.css';

export default function ImageGalleryModal({
  isOpen,
  onClose,
  onSelectImage,
  currentPath = '',
  initialCategory = 'all',
  title = 'Select Image from Gallery'
}) {
  const [selectedPath, setSelectedPath] = useState(currentPath || '');
  const [activeCategory, setActiveCategory] = useState(initialCategory || 'all');
  const [activeType, setActiveType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Custom upload & URL state
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [uploadedImages, setUploadedImages] = useState([]);
  const fileInputRef = useRef(null);

  // Sync currentPath and initialCategory when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedPath(currentPath || '');
      if (initialCategory && initialCategory !== 'all') {
        setActiveCategory(initialCategory);
      } else if (currentPath) {
        // Auto-detect category from currentPath
        const matched = findAssetByPath(currentPath);
        if (matched?.category) {
          setActiveCategory(matched.category);
        }
      }
    }
  }, [isOpen, currentPath, initialCategory]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && selectedPath) {
        handleConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedPath]);

  // Filtered built-in images
  const filteredAssets = useMemo(() => {
    return filterGalleryAssets({
      category: activeCategory,
      query: searchQuery,
      type: activeType
    });
  }, [activeCategory, searchQuery, activeType]);

  // Combined custom list
  const displayCustomList = useMemo(() => {
    if (activeCategory !== 'custom' && activeCategory !== 'all') return [];
    if (!searchQuery) return uploadedImages;
    const q = searchQuery.toLowerCase();
    return uploadedImages.filter(
      (img) => img.title.toLowerCase().includes(q) || img.path.toLowerCase().includes(q)
    );
  }, [activeCategory, searchQuery, uploadedImages]);

  // Category Icon mapper
  const renderCategoryIcon = (iconName) => {
    switch (iconName) {
      case 'Sparkles': return <Sparkles size={14} />;
      case 'Bot': return <Bot size={14} />;
      case 'Cpu': return <Cpu size={14} />;
      case 'Gauge': return <Gauge size={14} />;
      case 'Smile': return <Smile size={14} />;
      case 'Activity': return <Activity size={14} />;
      case 'Heart': return <Heart size={14} />;
      case 'Upload': return <Upload size={14} />;
      default: return <ImageIcon size={14} />;
    }
  };

  const handleCardClick = (path) => {
    setSelectedPath(path);
  };

  const handleCardDoubleClick = (path) => {
    setSelectedPath(path);
    if (onSelectImage) {
      onSelectImage(path);
    }
    onClose();
  };

  const handleConfirm = () => {
    if (selectedPath && onSelectImage) {
      onSelectImage(selectedPath);
    }
    onClose();
  };

  // Handle local file upload (converts to base64)
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64Data = uploadEvent.target?.result;
      if (base64Data) {
        const newCustomAsset = {
          id: `custom-${Date.now()}`,
          path: base64Data,
          filename: file.name,
          title: `Uploaded: ${file.name.replace(/\.[^.]+$/, '')}`,
          category: 'custom',
          type: 'upload',
          tags: ['custom', 'uploaded', file.name]
        };
        setUploadedImages((prev) => [newCustomAsset, ...prev]);
        setSelectedPath(base64Data);
        setActiveCategory('custom');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };

  const handleApplyCustomUrl = (e) => {
    e.preventDefault();
    if (!customUrlInput.trim()) return;

    const trimmed = customUrlInput.trim();
    const newCustomAsset = {
      id: `url-${Date.now()}`,
      path: trimmed,
      filename: trimmed.split('/').pop() || 'external-image',
      title: `Custom URL: ${trimmed.split('/').pop() || 'Image'}`,
      category: 'custom',
      type: 'url',
      tags: ['custom', 'url', trimmed]
    };

    setUploadedImages((prev) => [newCustomAsset, ...prev]);
    setSelectedPath(trimmed);
    setCustomUrlInput('');
    setActiveCategory('custom');
  };

  if (!isOpen) return null;

  const currentSelectionAsset = findAssetByPath(selectedPath);

  return (
    <div className="igm-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="igm-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="igm-header">
          <div className="igm-title-wrap">
            <div className="igm-title-icon-box">
              <ImageIcon size={22} className="igm-neon-icon" />
            </div>
            <div>
              <h2 className="igm-modal-title">{title}</h2>
              <p className="igm-modal-subtitle">
                Select from 89+ built-in HD robot assets or upload custom imagery
              </p>
            </div>
          </div>
          <button
            type="button"
            className="igm-close-btn"
            onClick={onClose}
            title="Close Gallery (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Categories Bar */}
        <div className="igm-categories-bar">
          {GALLERY_CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                className={`igm-cat-pill ${isActive ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {renderCategoryIcon(cat.icon)}
                <span>{cat.label}</span>
                {cat.count > 0 && <span className="igm-cat-count">{cat.count}</span>}
              </button>
            );
          })}
        </div>

        {/* Filter & Search Bar */}
        <div className="igm-filter-row">
          <div className="igm-search-box">
            <Search size={16} className="igm-search-icon" />
            <input
              type="text"
              className="igm-search-input"
              placeholder="Search images by name, robot, step, or tag (e.g. hero, 2, smile, lidar)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="igm-clear-search-btn"
                onClick={() => setSearchQuery('')}
                title="Clear Search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="igm-type-pills">
            {[
              { id: 'all', label: 'All Types' },
              { id: 'hero', label: 'Hero Poses' },
              { id: 'step', label: 'Tour Steps' },
              { id: 'photo', label: 'Photos' },
              { id: 'expression', label: 'Faces & Expressions' },
              { id: 'ui', label: 'UI & Graphics' }
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                className={`igm-type-chip ${activeType === t.id ? 'active' : ''}`}
                onClick={() => setActiveType(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="igm-content-body">
          {/* Custom Upload Section if on Custom tab or empty results */}
          {activeCategory === 'custom' && (
            <div className="igm-custom-upload-zone">
              <div className="igm-upload-box">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/png, image/jpeg, image/webp, image/svg+xml"
                  style={{ display: 'none' }}
                />
                <div
                  className="igm-dropzone"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={32} className="igm-dropzone-icon" />
                  <h4>Upload Image from Computer</h4>
                  <p>Supports WEBP, PNG, JPG, or SVG (processed securely on-device)</p>
                  <button type="button" className="igm-browse-btn">
                    Choose Local File
                  </button>
                </div>
              </div>

              <form onSubmit={handleApplyCustomUrl} className="igm-url-box">
                <h4>Or Paste Image URL / Custom Path</h4>
                <div className="igm-url-input-group">
                  <input
                    type="text"
                    value={customUrlInput}
                    onChange={(e) => setCustomUrlInput(e.target.value)}
                    placeholder="https://example.com/robot-image.webp or /custom/path.png"
                    className="igm-url-input"
                  />
                  <button type="submit" className="igm-url-submit-btn">
                    <ExternalLink size={15} />
                    <span>Load URL</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Grid of Images */}
          <div className="igm-grid-container">
            {/* Custom/Uploaded Images */}
            {displayCustomList.map((asset) => {
              const isSelected = selectedPath === asset.path;
              return (
                <div
                  key={asset.id}
                  className={`igm-image-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleCardClick(asset.path)}
                  onDoubleClick={() => handleCardDoubleClick(asset.path)}
                  title="Click to select, Double click to apply"
                >
                  <div className="igm-thumb-wrapper">
                    <img
                      src={asset.path}
                      alt={asset.title}
                      className="igm-thumb-img"
                      loading="lazy"
                    />
                    {isSelected && (
                      <div className="igm-selected-badge">
                        <Check size={16} />
                      </div>
                    )}
                    <span className="igm-card-type-tag custom">CUSTOM</span>
                  </div>
                  <div className="igm-card-meta">
                    <span className="igm-card-title">{asset.title}</span>
                    <span className="igm-card-path">{asset.filename}</span>
                  </div>
                </div>
              );
            })}

            {/* Built-in Gallery Assets */}
            {activeCategory !== 'custom' &&
              filteredAssets.map((asset) => {
                const isSelected = selectedPath === asset.path;
                return (
                  <div
                    key={asset.id}
                    className={`igm-image-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleCardClick(asset.path)}
                    onDoubleClick={() => handleCardDoubleClick(asset.path)}
                    title="Click to select, Double click to apply"
                  >
                    <div className="igm-thumb-wrapper">
                      <img
                        src={assetUrl(asset.path)}
                        alt={asset.title}
                        className="igm-thumb-img"
                        loading="lazy"
                        onError={(e) => {
                          e.target.src = assetUrl('/aurra/hero.webp');
                        }}
                      />
                      {isSelected && (
                        <div className="igm-selected-badge">
                          <Check size={16} />
                        </div>
                      )}
                      <span className={`igm-card-type-tag ${asset.type}`}>
                        {asset.type.toUpperCase()}
                      </span>
                    </div>
                    <div className="igm-card-meta">
                      <span className="igm-card-title">{asset.title}</span>
                      <span className="igm-card-path">{asset.path}</span>
                    </div>
                  </div>
                );
              })}

            {/* Empty state */}
            {filteredAssets.length === 0 && displayCustomList.length === 0 && (
              <div className="igm-empty-state">
                <ImageIcon size={48} className="igm-empty-icon" />
                <h3>No Matching Images Found</h3>
                <p>Try searching for a different keyword or select another robot tab.</p>
                <button
                  type="button"
                  className="igm-reset-filters-btn"
                  onClick={() => {
                    setActiveCategory('all');
                    setActiveType('all');
                    setSearchQuery('');
                  }}
                >
                  <RotateCcw size={15} />
                  <span>Reset All Filters</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer with Selected Preview & Actions */}
        <div className="igm-footer">
          <div className="igm-footer-preview">
            {selectedPath ? (
              <>
                <div className="igm-footer-thumb">
                  <img
                    src={selectedPath.startsWith('data:') ? selectedPath : assetUrl(selectedPath)}
                    alt="Current Selection"
                    onError={(e) => {
                      e.target.src = assetUrl('/aurra/hero.webp');
                    }}
                  />
                </div>
                <div className="igm-footer-info">
                  <div className="igm-footer-name-row">
                    <CheckCircle2 size={15} color="#00ffff" />
                    <strong>
                      {currentSelectionAsset?.title || 'Selected Image'}
                    </strong>
                  </div>
                  <span className="igm-footer-path">{selectedPath}</span>
                </div>
              </>
            ) : (
              <div className="igm-footer-placeholder">
                <ImageIcon size={16} />
                <span>No image selected yet. Click an image card above to choose.</span>
              </div>
            )}
          </div>

          <div className="igm-footer-actions">
            <button type="button" className="igm-btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="igm-btn-apply"
              onClick={handleConfirm}
              disabled={!selectedPath}
            >
              <Check size={16} />
              <span>Apply Selection</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
