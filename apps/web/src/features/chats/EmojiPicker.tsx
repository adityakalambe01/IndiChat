import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  Clock,
  Smile,
  Hand,
  Dog,
  Utensils,
  Trophy,
  Car,
  Lightbulb,
  Heart,
  Flag,
  Film,
  Sticker as StickerIcon,
  Plus,
  Star,
  Trash2,
  Sparkles,
  Upload,
  Link as LinkIcon,
  Loader2,
  Globe
} from 'lucide-react';
import { EMOJI_CATEGORIES, EmojiItem } from './emojiData';
import {
  ALL_STICKERS,
  STICKER_PACKS,
  StickerItem,
  getCustomStickers,
  saveCustomSticker,
  deleteCustomSticker,
  getStarredStickerIds,
  toggleStarSticker,
  getRecentStickerIds,
  recordRecentSticker,
  searchStickers
} from './stickerData';
import {
  CURATED_GIFS,
  GIF_CATEGORIES,
  GifItem,
  getRecentGifs,
  saveRecentGif,
  searchGifs,
  fetchOnlineGifs
} from './gifData';
import { api } from '../../services/api';
import { APP_NAME } from '../../config/appConfig';


export type MediaPickerMode = 'emojis' | 'gifs' | 'stickers';

interface EmojiPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onSelectGif?: (gifUrl: string, title?: string) => void;
  onSelectSticker?: (stickerUrl: string, name?: string) => void;
  onClose: () => void;
  initialMode?: MediaPickerMode;
  anchorRef?: React.RefObject<HTMLElement>;
  className?: string;
  style?: React.CSSProperties;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  recent: <Clock size={18} />,
  smileys: <Smile size={18} />,
  people: <Hand size={18} />,
  animals: <Dog size={18} />,
  food: <Utensils size={18} />,
  activities: <Trophy size={18} />,
  travel: <Car size={18} />,
  objects: <Lightbulb size={18} />,
  symbols: <Heart size={18} />,
  flags: <Flag size={18} />
};

const RECENT_EMOJIS_KEY = 'chat_recent_emojis';
const MAX_RECENT = 32;

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  onSelectEmoji,
  onSelectGif,
  onSelectSticker,
  onClose,
  initialMode = 'emojis',
  className = '',
  style
}) => {
  // Main Navigation Mode: emojis | gifs | stickers
  const [activeMode, setActiveMode] = useState<MediaPickerMode>(initialMode);

  // Common Search Query
  const [searchQuery, setSearchQuery] = useState('');

  // -------------------------------------------------------------
  // Emojis State
  // -------------------------------------------------------------
  const [activeEmojiTab, setActiveEmojiTab] = useState<string>('smileys');
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(RECENT_EMOJIS_KEY);
      return saved ? JSON.parse(saved) : ['😀', '😂', '😍', '👍', '❤️', '🔥', '🎉', '🙏'];
    } catch {
      return ['😀', '😂', '😍', '👍', '❤️', '🔥', '🎉', '🙏'];
    }
  });
  const [hoveredEmoji, setHoveredEmoji] = useState<{ emoji: string; name: string } | null>(null);

  // -------------------------------------------------------------
  // GIFs State
  // -------------------------------------------------------------
  const [activeGifCategory, setActiveGifCategory] = useState<string>('trending');
  const [recentGifs, setRecentGifs] = useState<GifItem[]>(() => getRecentGifs());
  const [onlineGifs, setOnlineGifs] = useState<GifItem[]>([]);
  const [fetchedGifQuery, setFetchedGifQuery] = useState<string>('');
  const [isSearchingGifs, setIsSearchingGifs] = useState<boolean>(false);
  const [customGifUrl, setCustomGifUrl] = useState('');
  const [showAddGifPrompt, setShowAddGifPrompt] = useState(false);

  // -------------------------------------------------------------
  // Stickers State
  // -------------------------------------------------------------
  const [activeStickerPack, setActiveStickerPack] = useState<string>('reactions');
  const [customStickers, setCustomStickers] = useState<StickerItem[]>(() => getCustomStickers());
  const [starredStickerIds, setStarredStickerIds] = useState<string[]>(() => getStarredStickerIds());
  const [recentStickerIds, setRecentStickerIds] = useState<string[]>(() => getRecentStickerIds());
  const [isUploadingSticker, setIsUploadingSticker] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Handle outside click & escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Mode change handler
  const handleModeChange = (mode: MediaPickerMode) => {
    setActiveMode(mode);
    setSearchQuery('');
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  };

  // -------------------------------------------------------------
  // Emoji Selection
  // -------------------------------------------------------------
  const handleEmojiClick = (emoji: string) => {
    onSelectEmoji(emoji);
    setRecentEmojis((prev) => {
      const updated = [emoji, ...prev.filter((e) => e !== emoji)].slice(0, MAX_RECENT);
      try {
        localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(updated));
      } catch {
        // Ignore quota
      }
      return updated;
    });
  };

  // Emoji Search Results
  const emojiSearchResults = useMemo(() => {
    if (activeMode !== 'emojis' || !searchQuery.trim()) return null;
    const query = searchQuery.trim().toLowerCase();

    const matches: EmojiItem[] = [];
    const seen = new Set<string>();

    for (const cat of EMOJI_CATEGORIES) {
      for (const item of cat.emojis) {
        if (seen.has(item.emoji)) continue;
        const matchesName = item.name.toLowerCase().includes(query);
        const matchesKeyword = item.keywords.some((k) => k.toLowerCase().includes(query));

        if (matchesName || matchesKeyword) {
          seen.add(item.emoji);
          matches.push(item);
        }
      }
    }
    return matches;
  }, [searchQuery, activeMode]);

  const currentEmojiCategory = useMemo(() => {
    return EMOJI_CATEGORIES.find((cat) => cat.id === activeEmojiTab) || EMOJI_CATEGORIES[0];
  }, [activeEmojiTab]);

  // -------------------------------------------------------------
  // GIF Selection & Search
  // -------------------------------------------------------------
  const handleGifClick = (gif: GifItem) => {
    saveRecentGif(gif);
    setRecentGifs(getRecentGifs());
    if (onSelectGif) {
      onSelectGif(gif.url, gif.title);
    }
  };

  const handleAddCustomGif = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customGifUrl.trim()) return;
    const url = customGifUrl.trim();
    const newGif: GifItem = {
      id: `custom-gif-${Date.now()}`,
      title: 'Custom GIF',
      category: 'trending',
      url,
      tags: ['custom', 'custom gif', 'web']
    };
    handleGifClick(newGif);
    setCustomGifUrl('');
    setShowAddGifPrompt(false);
  };

  // Live Google Tenor GIF Search (triggers when user types in search or switches category)
  useEffect(() => {
    if (activeMode !== 'gifs') return;

    const query = searchQuery.trim();

    // If recents category selected and no query, show recents directly without fetching
    if (!query && activeGifCategory === 'recents') {
      setIsSearchingGifs(false);
      setOnlineGifs([]);
      setFetchedGifQuery('');
      return;
    }

    let isMounted = true;
    setIsSearchingGifs(true);

    const debounceTime = query ? 350 : 0;
    const timer = setTimeout(async () => {
      try {
        const results = await fetchOnlineGifs(query, activeGifCategory);
        if (isMounted) {
          setOnlineGifs(results);
          setFetchedGifQuery(query || activeGifCategory);
          setIsSearchingGifs(false);
        }
      } catch (err) {
        if (isMounted) {
          setIsSearchingGifs(false);
        }
      }
    }, debounceTime);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [activeMode, searchQuery, activeGifCategory]);

  const gifList = useMemo(() => {
    if (activeMode !== 'gifs') return [];

    const query = searchQuery.trim();

    if (query) {
      return onlineGifs;
    }

    if (activeGifCategory === 'recents') {
      return recentGifs;
    }

    return onlineGifs;
  }, [activeMode, searchQuery, onlineGifs, activeGifCategory, recentGifs]);

  // -------------------------------------------------------------
  // Sticker Selection & Management
  // -------------------------------------------------------------
  const allAvailableStickers = useMemo(() => {
    return [...customStickers, ...ALL_STICKERS];
  }, [customStickers]);

  const handleStickerClick = (sticker: StickerItem) => {
    recordRecentSticker(sticker.id);
    setRecentStickerIds(getRecentStickerIds());
    if (onSelectSticker) {
      onSelectSticker(sticker.url, sticker.name);
    }
  };

  const handleToggleStar = (e: React.MouseEvent, stickerId: string) => {
    e.stopPropagation();
    const updated = toggleStarSticker(stickerId);
    setStarredStickerIds(updated);
  };

  const handleDeleteCustomSticker = (e: React.MouseEvent, stickerId: string) => {
    e.stopPropagation();
    const updated = deleteCustomSticker(stickerId);
    setCustomStickers(updated);
  };

  // Upload/Create custom sticker from device
  const handleStickerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingSticker(true);
    try {
      let finalUrl = '';
      try {
        // Attempt backend upload for permanent URL
        const uploadRes = await api.uploadFile(file);
        finalUrl = uploadRes.fileUrl;
      } catch {
        // Fallback to data URL
        finalUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      const stickerName = file.name.replace(/\.[^/.]+$/, '');
      const newSticker: StickerItem = {
        id: `custom-${Date.now()}`,
        name: stickerName,
        category: 'custom',
        url: finalUrl,
        tags: ['custom', 'my stickers', stickerName.toLowerCase()],
        isCustom: true
      };

      const updated = saveCustomSticker(newSticker);
      setCustomStickers(updated);
      setActiveStickerPack('custom');
      // Automatically send or select newly created sticker
      handleStickerClick(newSticker);
    } catch (err) {
      console.error('Failed to create custom sticker', err);
    } finally {
      setIsUploadingSticker(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const displayedStickers = useMemo(() => {
    if (activeMode !== 'stickers') return [];

    if (searchQuery.trim()) {
      return searchStickers(searchQuery.trim(), allAvailableStickers);
    }

    if (activeStickerPack === 'recent') {
      return recentStickerIds
        .map((id) => allAvailableStickers.find((s) => s.id === id))
        .filter((s): s is StickerItem => Boolean(s));
    }

    if (activeStickerPack === 'favorites') {
      return starredStickerIds
        .map((id) => allAvailableStickers.find((s) => s.id === id))
        .filter((s): s is StickerItem => Boolean(s));
    }

    if (activeStickerPack === 'custom') {
      return customStickers;
    }

    const pack = STICKER_PACKS.find((p) => p.id === activeStickerPack);
    return pack ? pack.stickers : ALL_STICKERS;
  }, [activeMode, searchQuery, activeStickerPack, allAvailableStickers, recentStickerIds, starredStickerIds, customStickers]);

  // Search input placeholder based on active mode
  const searchPlaceholder =
    activeMode === 'emojis'
      ? 'Search all emojis...'
      : activeMode === 'gifs'
      ? 'Search Google Tenor GIFs (e.g. cat, dance, cheers)...'
      : 'Search stickers (happy, cat, namaste)...';

  return (
    <div
      ref={pickerRef}
      id="emojiGifStickerPanel"
      className={`emoji-gif-sticker-panel emoji-picker-panel whatsapp-emoji-picker ${className}`}
      style={style}
      role="dialog"
      aria-label="Media Picker"
    >
      {/* Hidden File Input for Adding Custom Stickers */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
        style={{ display: 'none' }}
        onChange={handleStickerFileChange}
      />

      {/* Top Tabs Header matching preview design */}
      <div className="picker-tabs-header">
        <button
          type="button"
          className={`picker-tab-btn ${activeMode === 'emojis' ? 'active' : ''}`}
          data-picker-tab="emoji"
          onClick={() => handleModeChange('emojis')}
        >
          Emoji
        </button>
        <button
          type="button"
          className={`picker-tab-btn ${activeMode === 'gifs' ? 'active' : ''}`}
          data-picker-tab="gif"
          onClick={() => handleModeChange('gifs')}
        >
          GIF
        </button>
        <button
          type="button"
          className={`picker-tab-btn ${activeMode === 'stickers' ? 'active' : ''}`}
          data-picker-tab="sticker"
          onClick={() => handleModeChange('stickers')}
        >
          Stickers
        </button>
      </div>

      {/* Header & Search */}
      <div className="emoji-picker-header" style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', background: 'transparent' }}>
        <div className="emoji-search-box" style={{ background: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px' }}>
          <Search size={14} className="emoji-search-icon" style={{ opacity: 0.6 }} />
          <input
            ref={searchInputRef}
            type="text"
            className="emoji-search-input"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ fontSize: '12px' }}
          />
          {searchQuery && (
            <button
              type="button"
              className="emoji-search-clear"
              onClick={() => {
                setSearchQuery('');
                setOnlineGifs([]);
                setFetchedGifQuery('');
                searchInputRef.current?.focus();
              }}
              title="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <button
          type="button"
          className="emoji-picker-close icon-btn"
          onClick={onClose}
          title="Close (Esc)"
          aria-label="Close"
          style={{ width: '26px', height: '26px', padding: 0 }}
        >
          <X size={16} />
        </button>
      </div>

      {/* =========================================================
          MODE 1: EMOJIS
          ========================================================= */}
      {activeMode === 'emojis' && (
        <>
          {/* Category Tabs Bar */}
          <div className="emoji-category-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeEmojiTab === 'recent' && !searchQuery}
              className={`emoji-tab-btn ${activeEmojiTab === 'recent' && !searchQuery ? 'active' : ''}`}
              onClick={() => {
                setActiveEmojiTab('recent');
                setSearchQuery('');
              }}
              title="Recently Used"
            >
              {CATEGORY_ICONS.recent}
            </button>

            {EMOJI_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={activeEmojiTab === cat.id && !searchQuery}
                className={`emoji-tab-btn ${activeEmojiTab === cat.id && !searchQuery ? 'active' : ''}`}
                onClick={() => {
                  setActiveEmojiTab(cat.id);
                  setSearchQuery('');
                }}
                title={`${cat.name} (${cat.emojis.length})`}
              >
                {CATEGORY_ICONS[cat.id] || <Smile size={18} />}
              </button>
            ))}
          </div>

          {/* Emoji Content Grid */}
          <div ref={scrollContainerRef} id="pickerContentScroll" className="picker-content-scroll emoji-picker-scroll">
            {emojiSearchResults !== null ? (
              <div className="emoji-category-section">
                {emojiSearchResults.length === 0 ? (
                  <div className="emoji-no-results">
                    No emojis found matching "{searchQuery}"
                  </div>
                ) : (
                  <div className="emoji-grid">
                    {emojiSearchResults.map((item) => (
                      <button
                        key={item.emoji}
                        type="button"
                        className="emoji-btn-item emoji-item-btn"
                        data-insert-emoji={item.emoji}
                        onClick={() => handleEmojiClick(item.emoji)}
                        onMouseEnter={() => setHoveredEmoji({ emoji: item.emoji, name: item.name })}
                        onMouseLeave={() => setHoveredEmoji(null)}
                        title={item.name}
                        aria-label={item.name}
                      >
                        {item.emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : activeEmojiTab === 'recent' ? (
              <div className="emoji-category-section">
                {recentEmojis.length === 0 ? (
                  <div className="emoji-no-results">
                    No recently used emojis yet. Click any emoji to add it here!
                  </div>
                ) : (
                  <div className="emoji-grid">
                    {recentEmojis.map((emoji, idx) => (
                      <button
                        key={`recent-${emoji}-${idx}`}
                        type="button"
                        className="emoji-btn-item emoji-item-btn"
                        data-insert-emoji={emoji}
                        onClick={() => handleEmojiClick(emoji)}
                        onMouseEnter={() => setHoveredEmoji({ emoji, name: emoji })}
                        onMouseLeave={() => setHoveredEmoji(null)}
                        title={`Recent: ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="emoji-category-section">
                <div className="emoji-grid">
                  {currentEmojiCategory.emojis.map((item) => (
                    <button
                      key={item.emoji}
                      type="button"
                      className="emoji-btn-item emoji-item-btn"
                      data-insert-emoji={item.emoji}
                      onClick={() => handleEmojiClick(item.emoji)}
                      onMouseEnter={() => setHoveredEmoji({ emoji: item.emoji, name: item.name })}
                      onMouseLeave={() => setHoveredEmoji(null)}
                      title={item.name}
                      aria-label={item.name}
                    >
                      {item.emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Emoji Footer Preview */}
          <div className="emoji-picker-footer">
            {hoveredEmoji ? (
              <div className="emoji-hover-preview">
                <span className="emoji-preview-char">{hoveredEmoji.emoji}</span>
                <span className="emoji-preview-name">{hoveredEmoji.name}</span>
              </div>
            ) : (
              <div className="emoji-footer-title">
                {searchQuery
                  ? `Search: "${searchQuery}" (${emojiSearchResults?.length || 0})`
                  : activeEmojiTab === 'recent'
                  ? `Recently Used (${recentEmojis.length})`
                  : `${currentEmojiCategory.name} (${currentEmojiCategory.emojis.length})`}
              </div>
            )}
          </div>
        </>
      )}

      {/* =========================================================
          MODE 2: GIFS
          ========================================================= */}
      {activeMode === 'gifs' && (
        <>
          {/* GIF Category Chips & Controls Bar */}
          <div className="gif-categories-bar">
            <button
              type="button"
              className={`gif-chip-btn ${activeGifCategory === 'recents' && !searchQuery ? 'active' : ''}`}
              onClick={() => {
                setActiveGifCategory('recents');
                setSearchQuery('');
              }}
              title="Recent GIFs"
            >
              <Clock size={14} />
              <span>Recents</span>
            </button>

            {GIF_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`gif-chip-btn ${activeGifCategory === cat.id && !searchQuery ? 'active' : ''}`}
                onClick={() => {
                  setActiveGifCategory(cat.id);
                  setSearchQuery('');
                }}
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            ))}

            <button
              type="button"
              className={`gif-chip-btn custom-gif-add-btn ${showAddGifPrompt ? 'active' : ''}`}
              onClick={() => setShowAddGifPrompt(!showAddGifPrompt)}
              title="Add Custom GIF by URL"
            >
              <LinkIcon size={14} />
              <span>Add URL</span>
            </button>
          </div>

          {/* Quick Custom GIF URL Input Box */}
          {showAddGifPrompt && (
            <form onSubmit={handleAddCustomGif} className="custom-gif-form">
              <input
                type="url"
                placeholder="Paste animated GIF URL (https://...)"
                className="custom-gif-input"
                value={customGifUrl}
                onChange={(e) => setCustomGifUrl(e.target.value)}
                autoFocus
              />
              <button type="submit" className="custom-gif-send-btn" disabled={!customGifUrl.trim()}>
                Send GIF
              </button>
            </form>
          )}

          {/* GIF Content Grid */}
          <div ref={scrollContainerRef} id="pickerContentScroll" className="picker-content-scroll emoji-picker-scroll gif-picker-scroll">
            {/* Searching indicator banner */}
            {isSearchingGifs && (
              <div className="gif-search-loading-banner">
                <Loader2 size={15} className="spinning" />
                <span>Searching Google Tenor for &ldquo;{searchQuery || activeGifCategory}&rdquo;...</span>
              </div>
            )}

            {gifList.length === 0 && !isSearchingGifs ? (
              <div className="emoji-no-results">
                {searchQuery
                  ? `No GIFs found on Google Tenor matching "${searchQuery}". Try searching "cat", "happy", "cricket", "dance", or "cheers".`
                  : 'No GIFs found in this category.'}
              </div>
            ) : (
              <div className="gif-grid">
                {gifList.map((gif) => (
                  <div
                    key={gif.id}
                    className="gif-card-btn gif-card-item"
                    data-send-gif={gif.url}
                    data-gif-title={gif.title}
                    onClick={() => handleGifClick(gif)}
                    title={`Send: ${gif.title}`}
                  >
                    <img
                      src={gif.url}
                      alt={gif.title}
                      className="gif-image"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (!target.dataset.triedFallback) {
                          target.dataset.triedFallback = 'true';
                          if (gif.url.includes('media.tenor.com')) {
                            target.src = gif.url.replace('media.tenor.com', 'c.tenor.com');
                          } else if (gif.url.includes('c.tenor.com')) {
                            target.src = gif.url.replace('c.tenor.com', 'media.tenor.com');
                          } else if (gif.url.includes('i.giphy.com')) {
                            target.src = gif.url.replace('i.giphy.com', 'media.giphy.com');
                          } else if (gif.url.includes('media.giphy.com')) {
                            target.src = gif.url.replace('media.giphy.com', 'media1.giphy.com');
                          }
                        }
                      }}
                    />
                    <div className="gif-card-overlay">
                      <span className="gif-badge">GIF</span>
                      <span className="gif-title-text">{gif.title}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* GIF Footer */}
          <div className="emoji-picker-footer">
            <div className="emoji-footer-title">
              {isSearchingGifs ? (
                <span className="gif-footer-loading">
                  <Loader2 size={13} className="spinning" /> Searching Google Tenor...
                </span>
              ) : searchQuery ? (
                `Google Tenor GIFs for "${searchQuery}" (${gifList.length})`
              ) : activeGifCategory === 'recents' ? (
                `Recent GIFs (${recentGifs.length})`
              ) : (
                `${GIF_CATEGORIES.find((c) => c.id === activeGifCategory)?.name || 'Trending'} GIFs (${gifList.length})`
              )}
            </div>
            <div className="gif-powered-badge" title="Powered by Google Tenor GIF Search">
              <Globe size={13} />
              <span>Google Tenor</span>
            </div>
          </div>
        </>
      )}

      {/* =========================================================
          MODE 3: STICKERS
          ========================================================= */}
      {activeMode === 'stickers' && (
        <>
          {/* Sticker Packs Tabs & Add Sticker Button */}
          <div className="sticker-packs-bar">
            {/* 1. Recents */}
            <button
              type="button"
              className={`sticker-pack-btn ${activeStickerPack === 'recent' && !searchQuery ? 'active' : ''}`}
              onClick={() => {
                setActiveStickerPack('recent');
                setSearchQuery('');
              }}
              title="Recent Stickers"
            >
              <Clock size={16} />
            </button>

            {/* 2. Starred / Favorites */}
            <button
              type="button"
              className={`sticker-pack-btn ${activeStickerPack === 'favorites' && !searchQuery ? 'active' : ''}`}
              onClick={() => {
                setActiveStickerPack('favorites');
                setSearchQuery('');
              }}
              title="Favorites & Starred"
            >
              <Star size={16} />
            </button>

            {/* 3. My Custom Stickers */}
            <button
              type="button"
              className={`sticker-pack-btn ${activeStickerPack === 'custom' && !searchQuery ? 'active' : ''}`}
              onClick={() => {
                setActiveStickerPack('custom');
                setSearchQuery('');
              }}
              title={`My Custom Stickers (${customStickers.length})`}
            >
              <Sparkles size={16} />
            </button>

            {/* Built-in Packs */}
            {STICKER_PACKS.map((pack) => (
              <button
                key={pack.id}
                type="button"
                className={`sticker-pack-btn ${activeStickerPack === pack.id && !searchQuery ? 'active' : ''}`}
                onClick={() => {
                  setActiveStickerPack(pack.id);
                  setSearchQuery('');
                }}
                title={pack.name}
              >
                <span className="sticker-pack-icon">{pack.icon}</span>
              </button>
            ))}

            {/* + Add / Create Custom Sticker Button */}
            <button
              type="button"
              className="sticker-add-new-btn"
              onClick={() => fileInputRef.current?.click()}
              title="Add Sticker (Create from photo or image)"
              disabled={isUploadingSticker}
            >
              <Plus size={16} />
              <span>Add</span>
            </button>
          </div>

          {/* Stickers Grid */}
          <div ref={scrollContainerRef} id="pickerContentScroll" className="picker-content-scroll emoji-picker-scroll sticker-picker-scroll">
            {isUploadingSticker && (
              <div className="sticker-uploading-indicator">
                <Upload size={20} className="spinning" />
                <span>Creating sticker...</span>
              </div>
            )}

            {displayedStickers.length === 0 ? (
              <div className="sticker-empty-state">
                {activeStickerPack === 'custom' ? (
                  <>
                    <div className="sticker-empty-icon">
                      <Sparkles size={36} />
                    </div>
                    <h4>No Custom Stickers Yet</h4>
                    <p>Click "Add" to turn any image, photo, or transparent PNG into an {APP_NAME} sticker!</p>
                    <button
                      type="button"
                      className="create-sticker-cta-btn"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Plus size={16} />
                      <span>Create Your First Sticker</span>
                    </button>
                  </>
                ) : activeStickerPack === 'favorites' ? (
                  <>
                    <div className="sticker-empty-icon">
                      <Star size={36} />
                    </div>
                    <h4>No Starred Stickers</h4>
                    <p>Hover over any sticker and click the star icon to save it here for fast access!</p>
                  </>
                ) : (
                  <div className="emoji-no-results">
                    No stickers found matching "{searchQuery}"
                  </div>
                )}
              </div>
            ) : (
              <div className="sticker-grid">
                {/* Large "+ Create Sticker" card in custom pack */}
                {activeStickerPack === 'custom' && !searchQuery && (
                  <button
                    type="button"
                    className="sticker-create-card-btn"
                    onClick={() => fileInputRef.current?.click()}
                    title="Upload image to create custom sticker"
                  >
                    <div className="sticker-create-card-inner">
                      <Plus size={26} color="#00a884" />
                      <span>New Sticker</span>
                    </div>
                  </button>
                )}

                {displayedStickers.map((sticker) => {
                  const isStarred = starredStickerIds.includes(sticker.id);

                  return (
                    <div
                      key={sticker.id}
                      className="sticker-card-btn sticker-item-card"
                      data-send-sticker={sticker.url}
                      data-sticker-name={sticker.name}
                      onClick={() => handleStickerClick(sticker)}
                      title={`Send: ${sticker.name}`}
                    >
                      <img
                        src={sticker.url}
                        alt={sticker.name}
                        className="sticker-image-preview"
                        loading="lazy"
                      />

                      {/* Quick Action Buttons on Hover */}
                      <div className="sticker-card-actions">
                        <button
                          type="button"
                          className={`sticker-action-btn ${isStarred ? 'starred' : ''}`}
                          onClick={(e) => handleToggleStar(e, sticker.id)}
                          title={isStarred ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <Star size={12} fill={isStarred ? '#FFCC00' : 'none'} color={isStarred ? '#FFCC00' : 'currentColor'} />
                        </button>

                        {sticker.isCustom && (
                          <button
                            type="button"
                            className="sticker-action-btn delete-btn"
                            onClick={(e) => handleDeleteCustomSticker(e, sticker.id)}
                            title="Delete custom sticker"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sticker Footer */}
          <div className="emoji-picker-footer">
            <div className="emoji-footer-title">
              {searchQuery
                ? `Stickers for "${searchQuery}" (${displayedStickers.length})`
                : activeStickerPack === 'recent'
                ? `Recent Stickers (${displayedStickers.length})`
                : activeStickerPack === 'favorites'
                ? `Favorite Stickers (${displayedStickers.length})`
                : activeStickerPack === 'custom'
                ? `My Stickers (${customStickers.length})`
                : `${STICKER_PACKS.find((p) => p.id === activeStickerPack)?.name || 'Stickers'} (${displayedStickers.length})`}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
