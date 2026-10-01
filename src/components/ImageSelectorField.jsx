import React, { useState } from 'react';
import {
  Image as ImageIcon,
  Sparkles,
  Edit3,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from 'lucide-react';
import { assetUrl } from '../utils/platform';
import { getPresetsForRobot, findAssetByPath } from '../data/galleryAssets';
import ImageGalleryModal from './ImageGalleryModal';
import './ImageSelectorField.css';

export default function ImageSelectorField({
  label = 'Image',
  value = '',
  onChange,
  robotSlug = 'aurra',
  placeholder = '/aurra/hero.webp',
  fallbackDefault = '/aurra/hero.webp',
  modalTitle = 'Select Image from Gallery',
  required = false,
  helperText = ''
}) {
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);

  const presets = getPresetsForRobot(robotSlug);
  const matchedAsset = findAssetByPath(value);

  const displayTitle = matchedAsset?.title || (value ? value.split('/').pop() : 'No image chosen');

  const handleSelectFromGallery = (newPath) => {
    if (onChange) {
      onChange(newPath);
    }
  };

  const handleClear = () => {
    if (onChange) {
      onChange('');
    }
  };

  return (
    <div className="isf-root-container">
      {label && (
        <div className="isf-label-row">
          <label className="isf-main-label">
            {label} {required && <span className="isf-required">*</span>}
          </label>
          <button
            type="button"
            className="isf-manual-toggle-btn"
            onClick={() => setShowManualInput(!showManualInput)}
          >
            {showManualInput ? (
              <>
                <ChevronUp size={13} />
                <span>Hide Manual Input</span>
              </>
            ) : (
              <>
                <Edit3 size={13} />
                <span>Type Custom Path</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Main Visual Display Card */}
      <div className={`isf-preview-card ${value ? 'has-value' : 'empty'}`}>
        <div className="isf-thumb-box" onClick={() => setIsGalleryOpen(true)}>
          <img
            src={value ? (value.startsWith('data:') ? value : assetUrl(value)) : assetUrl(fallbackDefault)}
            alt="Preview"
            className="isf-thumb-img"
            onError={(e) => {
              e.target.src = assetUrl(fallbackDefault);
            }}
          />
          <div className="isf-thumb-overlay" title="Click to open gallery">
            <Sparkles size={16} />
          </div>
        </div>

        <div className="isf-info-box">
          <div className="isf-title-line">
            <span className="isf-image-name">{displayTitle}</span>
            {matchedAsset?.category && (
              <span className={`isf-cat-badge ${matchedAsset.category}`}>
                {matchedAsset.category.toUpperCase()}
              </span>
            )}
          </div>
          <span className="isf-path-display">
            {value ? value : <em className="isf-empty-hint">No image path selected yet</em>}
          </span>
        </div>

        <div className="isf-actions-box">
          <button
            type="button"
            className="isf-gallery-btn"
            onClick={() => setIsGalleryOpen(true)}
          >
            <ImageIcon size={15} />
            <span>Select from Gallery</span>
          </button>

          {value && (
            <button
              type="button"
              className="isf-clear-btn"
              onClick={handleClear}
              title="Clear Image"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Manual Input (Collapsible) */}
      {showManualInput && (
        <div className="isf-manual-input-box">
          <input
            type="text"
            className="isf-text-input"
            value={value}
            onChange={(e) => onChange && onChange(e.target.value)}
            placeholder={placeholder}
          />
          <span className="isf-manual-hint">
            Direct file path (e.g. <code>/aurra/hero.webp</code>) or remote web URL (<code>https://...</code>)
          </span>
        </div>
      )}

      {/* Quick 1-Click Presets Carousel */}
      {presets && presets.length > 0 && (
        <div className="isf-presets-row">
          <span className="isf-presets-tag">Quick Pick:</span>
          <div className="isf-presets-scroll">
            {presets.map((preset) => {
              const isSelected = value === preset.path;
              return (
                <button
                  key={preset.path}
                  type="button"
                  className={`isf-preset-chip ${isSelected ? 'active' : ''}`}
                  onClick={() => onChange && onChange(preset.path)}
                  title={preset.title}
                >
                  <img
                    src={assetUrl(preset.path)}
                    alt={preset.title}
                    className="isf-chip-thumb"
                    onError={(e) => {
                      e.target.src = assetUrl(fallbackDefault);
                    }}
                  />
                  <span className="isf-chip-label">
                    {preset.filename.replace(/\.[^.]+$/, '')}
                  </span>
                  {isSelected && <Check size={12} className="isf-chip-check" />}
                </button>
              );
            })}
            <button
              type="button"
              className="isf-preset-more-btn"
              onClick={() => setIsGalleryOpen(true)}
            >
              + All 89 Images
            </button>
          </div>
        </div>
      )}

      {helperText && <p className="isf-helper-text">{helperText}</p>}

      {/* Dedicated Gallery Modal */}
      <ImageGalleryModal
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        onSelectImage={handleSelectFromGallery}
        currentPath={value}
        initialCategory={robotSlug || 'aurra'}
        title={modalTitle}
      />
    </div>
  );
}
