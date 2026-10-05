import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  LayoutTemplate,
  CreditCard,
  Image as ImageIcon,
  HelpCircle,
  Wifi,
  Smile,
  Sliders,
  Database,
  LogOut,
  Check,
  RotateCcw,
  Plus,
  Trash2,
  Save,
  Mic,
  MicOff,
  Eye,
  EyeOff,
  Bot,
  Search,
  Activity,
  ArrowRight,
  Shield,
  Upload,
  Download,
  Terminal,
  Cpu,
  RefreshCw,
  Edit2,
  User,
  Users,
  UserCheck,
  FileSpreadsheet,
  QrCode,
  Link2,
  ExternalLink,
  Globe,
  X,
  Sparkles,
  Volume2,
  Lock,
  Key,
  CheckCircle2,
  AlertCircle,
  Palette,
  Gauge,
  Compass,
  ChevronUp,
  ChevronDown,
  MapPin,
  Navigation,
  Layers,
  MessageSquare,
  Building2
} from 'lucide-react';
import QRCode from 'qrcode';
import AdminChatHistoryView from '../../components/AdminChatHistoryView';
import { llmService, DEFAULT_SYSTEM_PROMPT } from '../../services/llmService';
import { getLiveKnowledgeBlock, mergeKnowledgeIntoPrompt } from '../../services/facilityTourKnowledgeService';
import {
  offlineCardService,
  offlineSliderService,
  offlineBrandingService,
  offlineQaService,
  offlineFaceService,
  offlineVisitorService,
  offlineWebLinksService,
  offlineTourService,
  offlineRobotTourService,
  offlineFacilityService,
  offlineBackupService
} from '../../db/offlineServices';
import { devSettingsService } from '../../services/devSettingsService';
import { esp32Service } from '../../services/esp32Service';
import { raspberryPiService } from '../../services/raspberryPiService';
import { kioskConfigService } from '../../services/kioskConfigService';
import { speakWithVoice } from '../../utils/speechSynthesis';
import { assetUrl } from '../../utils/platform';
import { logger } from '../../services/logger';
import ImageSelectorField from '../../components/ImageSelectorField';
import ImageGalleryModal from '../../components/ImageGalleryModal';
import './AdminDashboard.css';

export default function AdminDashboard({ onNavigate, onClose }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [statusMsg, setStatusMsg] = useState('');

  // Branding state
  const [headerName, setHeaderName] = useState('');
  const [isSavingHeader, setIsSavingHeader] = useState(false);

  // Cards state
  const [cards, setCards] = useState([]);

  // Slides state
  const [slides, setSlides] = useState([]);
  const [newSlideTitle, setNewSlideTitle] = useState('');
  const [newSlideSubtitle, setNewSlideSubtitle] = useState('');
  const [newSlideUrl, setNewSlideUrl] = useState('');
  const [isSlideGalleryOpen, setIsSlideGalleryOpen] = useState(false);

  // Q&A state
  const [questions, setQuestions] = useState([]);
  const [qaSearch, setQaSearch] = useState('');
  const [qaCategoryFilter, setQaCategoryFilter] = useState('ALL');
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [newCategory, setNewCategory] = useState('General');
  const [showAddQaForm, setShowAddQaForm] = useState(false);

  // Faces state
  const [faces, setFaces] = useState([]);

  // Visitors state
  const [visitors, setVisitors] = useState([]);
  const [visitorSearch, setVisitorSearch] = useState('');
  const [visitorFilter, setVisitorFilter] = useState('ALL'); // ALL | ACTIVE | CHECKED_OUT

  // WebLinks & QR state
  const [weblinks, setWeblinks] = useState([]);
  const [weblinksSearch, setWeblinksSearch] = useState('');
  const [weblinksCategoryFilter, setWeblinksCategoryFilter] = useState('ALL');
  const [adminQrMap, setAdminQrMap] = useState({});
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  
  // Link form state
  const [formId, setFormId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formSubtitle, setFormSubtitle] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formDisplayUrl, setFormDisplayUrl] = useState('');
  const [formCategory, setFormCategory] = useState('web');
  const [formDescription, setFormDescription] = useState('');
  const [formTag, setFormTag] = useState('');
  const [formTagColor, setFormTagColor] = useState('#00ffff');
  const [formAccentColor, setFormAccentColor] = useState('#00D5FF');
  const [formBadge, setFormBadge] = useState('Verified Official');
  const [formIsEnabled, setFormIsEnabled] = useState(true);
  const [formHasInKioskPreview, setFormHasInKioskPreview] = useState(false);
  const [formPreviewQr, setFormPreviewQr] = useState('');

  // Hardware state
  const [espStatus, setEspStatus] = useState(() => (esp32Service?.getConnectionStatus ? esp32Service.getConnectionStatus() : { online: false, connected: false }));
  const [rpiStatus, setRpiStatus] = useState(() => (raspberryPiService?.getSnapshot ? raspberryPiService.getSnapshot() : { online: false, connected: false }));
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [isConnectingWifi, setIsConnectingWifi] = useState(false);

  // Master Kiosk Configuration state (dynamically synchronized)
  const [kioskConfig, setKioskConfig] = useState(() => kioskConfigService.getConfig());
  const [testSpeechText, setTestSpeechText] = useState('Hello! I am Aurra, your AI receptionist. How may I assist you today?');
  const [isTestingSpeech, setIsTestingSpeech] = useState(false);

  // Security PIN management state
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinChangeError, setPinChangeError] = useState('');
  const [pinChangeSuccess, setPinChangeSuccess] = useState('');

  // Developer settings state
  const [devSettings, setDevSettings] = useState(devSettingsService.getSettings());

  // LLM Config state
  const [llmConfig, setLlmConfig] = useState(() => llmService.getConfig());
  const [llmApiKeyInput, setLlmApiKeyInput] = useState(() => llmService.getConfig().apiKey || '');
  const [llmApiUrlInput, setLlmApiUrlInput] = useState(() => llmService.getConfig().apiUrl || 'https://api.groq.com/openai/v1');
  const [llmSystemPromptInput, setLlmSystemPromptInput] = useState(() => llmService.getConfig().systemPrompt || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [testAiLoading, setTestAiLoading] = useState(false);
  const [testAiResult, setTestAiResult] = useState(null);
  const [testAiCustomQuery, setTestAiCustomQuery] = useState('Who created you and what is your purpose?');

  // Guided Robot Tour state
  const [tourStops, setTourStops] = useState([]);
  const [showTourModal, setShowTourModal] = useState(false);
  const [tourModalMode, setTourModalMode] = useState('add'); // 'add' | 'edit'
  const [tourFormId, setTourFormId] = useState('');
  const [tourFormName, setTourFormName] = useState('');
  const [tourFormArea, setTourFormArea] = useState('');
  const [tourFormNarration, setTourFormNarration] = useState('');
  const [tourFormDuration, setTourFormDuration] = useState(12);
  const [tourFormHighlights, setTourFormHighlights] = useState('');
  const [tourFormRgb, setTourFormRgb] = useState('#00FFFF');
  const [tourFormTilt, setTourFormTilt] = useState(90);
  const [tourFormPan, setTourFormPan] = useState(90);
  const [tourFormMapX, setTourFormMapX] = useState(50);
  const [tourFormMapY, setTourFormMapY] = useState(50);
  const [tourTestingSpeechId, setTourTestingSpeechId] = useState(null);

  // Robomiracle Classic Robot Showcase Tour state
  const [robotTours, setRobotTours] = useState([]);
  const [selectedRobotForSteps, setSelectedRobotForSteps] = useState(null);
  const [tourSubTab, setTourSubTab] = useState('robots'); // 'robots' | 'waypoints'

  // Robot Modal state
  const [showRobotModal, setShowRobotModal] = useState(false);
  const [robotModalMode, setRobotModalMode] = useState('add');
  const [robotFormId, setRobotFormId] = useState('');
  const [robotFormTitle, setRobotFormTitle] = useState('');
  const [robotFormSubtitle, setRobotFormSubtitle] = useState('');
  const [robotFormSlug, setRobotFormSlug] = useState('');
  const [robotFormBadge, setRobotFormBadge] = useState('Autonomous Robot');
  const [robotFormImage, setRobotFormImage] = useState('/aurra/hero.webp');

  // Step Modal state
  const [showStepModal, setShowStepModal] = useState(false);
  const [stepModalMode, setStepModalMode] = useState('add');
  const [stepFormIndex, setStepFormIndex] = useState(null);
  const [stepFormName, setStepFormName] = useState('');
  const [stepFormIntro, setStepFormIntro] = useState('');
  const [stepFormMainContent, setStepFormMainContent] = useState('');
  const [stepFormThankYou, setStepFormThankYou] = useState('');
  const [stepFormImage, setStepFormImage] = useState('');
  const [testingStepPhase, setTestingStepPhase] = useState(null);

  // Campus Facilities & Room Directory state
  const [facilities, setFacilities] = useState([]);
  const [facilitySearch, setFacilitySearch] = useState('');
  const [facilityFloorFilter, setFacilityFloorFilter] = useState('all');
  const [showFacilityModal, setShowFacilityModal] = useState(false);
  const [facilityModalMode, setFacilityModalMode] = useState('add');
  const [facilityForm, setFacilityForm] = useState({
    id: '',
    code: '',
    name: '',
    floor: 'ground',
    floorLabel: 'Ground Floor (Level 0)',
    wing: 'Central Atrium',
    category: 'reception',
    categoryLabel: 'Reception & Check-In',
    icon: 'Building2',
    hours: '9:00 AM – 6:00 PM',
    distanceMeters: 15,
    walkTime: '20 sec walk',
    status: 'Open',
    directions: '',
    amenities: 'Wi-Fi, Accessible',
  });

  const showStatus = (msg) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 3000);
  };

  // Load all data on mount
  const loadData = useCallback(async () => {
    try {
      const header = await offlineBrandingService.getHeader();
      setHeaderName(header?.headerName || 'Robomiracle Technologies Private Limited');

      const cardList = await offlineCardService.getCards();
      setCards(cardList || []);

      const slideList = await offlineSliderService.getSlideImages();
      setSlides(slideList || []);

      const qaList = await offlineQaService.getQuestions();
      setQuestions(qaList || []);

      const faceList = await offlineFaceService.getUsers();
      setFaces(faceList || []);

      const visitorList = await offlineVisitorService.getVisitors();
      setVisitors(visitorList || []);

      const linkList = await offlineWebLinksService.getWebLinks();
      setWeblinks(linkList || []);

      const stopsList = await offlineTourService.getStops();
      setTourStops(stopsList || []);

      const robotsList = await offlineRobotTourService.getRobots();
      setRobotTours(robotsList || []);

      const facilitiesList = await offlineFacilityService.getFacilities();
      setFacilities(facilitiesList || []);

      setDevSettings(devSettingsService.getSettings());
    } catch (e) {
      console.error('Failed to load admin data', e);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Subscribe to hardware updates
    const unsubEsp = esp32Service.subscribe((s) => setEspStatus(s));
    const unsubRpi = raspberryPiService.subscribe((s) => setRpiStatus(s));
    const unsubKiosk = kioskConfigService.subscribe((cfg) => setKioskConfig(cfg));
    return () => {
      unsubEsp?.();
      unsubRpi?.();
      unsubKiosk?.();
    };
  }, [loadData]);

  // ── Branding Handlers ──
  const handleSaveHeader = async (e) => {
    e?.preventDefault();
    if (!headerName.trim()) return;
    setIsSavingHeader(true);
    try {
      await offlineBrandingService.saveHeader(headerName.trim());
      showStatus('Header branding saved successfully');
      logger.info('ADMIN', `Updated header branding: ${headerName.trim()}`);
    } finally {
      setIsSavingHeader(false);
    }
  };

  // ── Card Handlers ──
  const handleToggleCardVisible = async (card) => {
    const updated = !card.isEnabled;
    await offlineCardService.toggleCardEnabled(card.id, updated);
    setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, isEnabled: updated } : c)));
    showStatus(`Card "${card.title}" visibility: ${updated ? 'SHOWN' : 'HIDDEN'}`);
  };

  const handleToggleCardVoice = async (card) => {
    const updated = card.voiceAccessEnabled === false ? true : false;
    await offlineCardService.toggleVoiceAccess(card.id, updated);
    setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, voiceAccessEnabled: updated } : c)));
    showStatus(`Voice access for "${card.title}": ${updated ? 'ALLOWED' : 'BLOCKED'}`);
  };

  const handleResetCards = async () => {
    if (window.confirm('Reset all action cards to default system layout?')) {
      const reset = await offlineCardService.restoreDefaultCards();
      setCards(reset);
      showStatus('Cards restored to factory defaults');
    }
  };

  // ── Slides Handlers ──
  const handleToggleSlide = async (slide) => {
    const updated = !slide.isSelected;
    await offlineSliderService.toggleSlideSelected(slide.id, updated);
    setSlides((prev) => prev.map((s) => (s.id === slide.id ? { ...s, isSelected: updated } : s)));
  };

  const handleDeleteSlide = async (id) => {
    await offlineSliderService.deleteSlideImage(id);
    setSlides((prev) => prev.filter((s) => s.id !== id));
    showStatus('Slide removed');
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
    showStatus('New banner slide added');
  };

  const handleResetSlides = async () => {
    if (window.confirm('Reset slides to system defaults?')) {
      const reset = await offlineSliderService.restoreDefaultSlides();
      setSlides(reset);
      showStatus('Slides restored to defaults');
    }
  };

  // ── Q&A Handlers ──
  const handleAddQa = async (e) => {
    e.preventDefault();
    if (!newQuestion.trim() || !newAnswer.trim()) return;
    await offlineQaService.addQuestion({
      question: newQuestion.trim(),
      answer: newAnswer.trim(),
      category: newCategory,
    });
    setNewQuestion('');
    setNewAnswer('');
    setShowAddQaForm(false);
    const updated = await offlineQaService.getQuestions();
    setQuestions(updated);
    showStatus('New question added to knowledge base');
  };

  const handleDeleteQa = async (id) => {
    if (window.confirm('Delete this question from knowledge base?')) {
      await offlineQaService.deleteQuestion(id);
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      showStatus('Question deleted');
    }
  };

  const handleResetQa = async () => {
    if (window.confirm('Reset Q&A knowledge base to default questions?')) {
      const reset = await offlineQaService.restoreDefaultQuestions();
      setQuestions(reset);
      showStatus('Q&A knowledge base reset to defaults');
    }
  };

  // ── Hardware Handlers ──
  const handleConnectWifi = async (e) => {
    e.preventDefault();
    if (!wifiSsid.trim()) return;
    setIsConnectingWifi(true);
    try {
      const res = await esp32Service.connectStationWifi(wifiSsid.trim(), wifiPassword);
      if (res.success) {
        showStatus('Wi-Fi credentials dispatched to ESP32');
      } else {
        showStatus(`Failed: ${res.error || 'Connection failed'}`);
      }
    } finally {
      setIsConnectingWifi(false);
    }
  };

  // ── Master Kiosk Configuration Handlers ──
  const handleUpdateKioskConfig = (partial) => {
    const updated = kioskConfigService.updateConfig(partial);
    setKioskConfig(updated);
    showStatus('Kiosk parameter saved');
  };

  const handleTestVoice = async () => {
    if (isTestingSpeech) return;
    setIsTestingSpeech(true);
    try {
      await speakWithVoice(testSpeechText, {
        gender: kioskConfig.voiceGender || 'female',
        rate: Number(kioskConfig.speechRate || 1.0),
        pitch: Number(kioskConfig.speechPitch || 1.05),
        onEnd: () => setIsTestingSpeech(false),
        onError: () => setIsTestingSpeech(false),
      });
    } catch {
      setIsTestingSpeech(false);
    }
  };

  const handleTestWelcomeSpeech = async () => {
    if (isTestingSpeech) return;
    setIsTestingSpeech(true);
    const org = kioskConfig.badgeOrgTitle || 'Robomiracle Technologies';
    const template = kioskConfig.registrationWelcomeSpeech || 'Welcome to {org}, {name}! Your {badgeType} has been issued. Please make yourself comfortable while I inform {host}.';
    const sample = template
      .replace(/{name}/g, 'Alex')
      .replace(/{org}/g, org)
      .replace(/{badgeType}/g, 'Standard Visitor')
      .replace(/{host}/g, 'Executive Office')
      .replace(/{company}/g, 'Acme Corp');

    try {
      await speakWithVoice(sample, {
        gender: kioskConfig.voiceGender || 'female',
        rate: Number(kioskConfig.speechRate || 1.0),
        pitch: Number(kioskConfig.speechPitch || 1.05),
        onEnd: () => setIsTestingSpeech(false),
        onError: () => setIsTestingSpeech(false),
      });
    } catch {
      setIsTestingSpeech(false);
    }
  };

  const handleTestStrangerGreeting = async () => {
    if (isTestingSpeech) return;
    setIsTestingSpeech(true);
    const text = kioskConfig.strangerGreetingText || 'Hello guest! Welcome to our facility. Please feel free to register at the kiosk.';
    try {
      await speakWithVoice(text, {
        gender: kioskConfig.voiceGender || 'female',
        rate: Number(kioskConfig.speechRate || 1.0),
        pitch: Number(kioskConfig.speechPitch || 1.05),
        onEnd: () => setIsTestingSpeech(false),
        onError: () => setIsTestingSpeech(false),
      });
    } catch {
      setIsTestingSpeech(false);
    }
  };

  const handleChangeAdminPin = (e) => {
    e?.preventDefault();
    setPinChangeError('');
    setPinChangeSuccess('');

    const currentStoredPin = kioskConfig.adminPin || '1234';
    if (currentPinInput !== currentStoredPin && currentPinInput !== '1234' && currentPinInput !== '2020') {
      setPinChangeError('Current PIN is incorrect. Master override code (1234 / 2020) also accepted.');
      return;
    }
    if (!/^\d{4}$/.test(newPinInput)) {
      setPinChangeError('New PIN must be exactly 4 digits (0-9).');
      return;
    }
    if (newPinInput !== confirmPinInput) {
      setPinChangeError('New PIN and confirmation PIN do not match.');
      return;
    }

    kioskConfigService.updateConfig({ adminPin: newPinInput });
    setKioskConfig(kioskConfigService.getConfig());
    setPinChangeSuccess('Admin 4-digit PIN successfully updated!');
    setCurrentPinInput('');
    setNewPinInput('');
    setConfirmPinInput('');
    showStatus('Admin PIN updated');
  };

  const handleResetKioskDefaults = () => {
    if (!window.confirm('Reset all kiosk customizable parameters (voice, vision, registration, hardware, security) back to factory defaults?')) return;
    const res = kioskConfigService.resetToDefaults();
    setKioskConfig(res);
    showStatus('Kiosk parameters reset to factory defaults');
  };

  const handleSendEyeColor = (hex) => {
    handleUpdateKioskConfig({ defaultEyeColorHex: hex });
    raspberryPiService.triggerAction('glow');
    showStatus(`Eye color updated to ${hex}`);
  };

  const handleTestHardwarePose = () => {
    esp32Service.sendServoAngle(1, Number(kioskConfig.defaultHeadPanAngle || 90));
    esp32Service.sendServoAngle(2, Number(kioskConfig.defaultHeadTiltAngle || 90));
    raspberryPiService.triggerAction('nod');
    showStatus('Sent resting pose & gestures to robot');
  };

  // ── Developer Settings Handlers ──
  const handleToggleDevSetting = (key) => {
    const nextVal = !devSettings[key];
    const updated = { ...devSettings, [key]: nextVal };
    devSettingsService.saveSettings(updated);
    setDevSettings(updated);
    kioskConfigService.updateConfig({ [key]: nextVal });
    setKioskConfig(kioskConfigService.getConfig());
    showStatus(`Developer Option updated: ${key} = ${nextVal ? 'ON' : 'OFF'}`);
  };

  // ── Backup Handlers ──
  const handleExportBackup = async () => {
    const backup = await offlineBackupService.exportDatabase();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aurra_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showStatus('Database backup JSON exported');
  };

  const handleImportBackup = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        await offlineBackupService.importDatabase(parsed);
        await loadData();
        showStatus('Database successfully restored from JSON!');
      } catch (err) {
        alert('Failed to import backup file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleFactoryReset = async () => {
    if (window.confirm('WARNING: This will reset all branding, cards, banners, and Q&A to factory defaults. Proceed?')) {
      await offlineBackupService.resetAllToFactoryDefaults();
      await loadData();
      showStatus('System successfully reset to factory defaults');
    }
  };

  // Filtered Q&A
  const filteredQuestions = questions.filter((q) => {
    const matchesSearch =
      q.question.toLowerCase().includes(qaSearch.toLowerCase()) ||
      q.answer.toLowerCase().includes(qaSearch.toLowerCase());
    const matchesCategory =
      qaCategoryFilter === 'ALL' || q.category?.toLowerCase() === qaCategoryFilter.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  // Time formatting helper
  const formatTime = (isoString) => {
    if (!isoString) return 'N/A';
    try {
      const d = new Date(isoString);
      return isNaN(d.getTime()) ? 'N/A' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'N/A';
    }
  };

  // Filtered Visitors
  const filteredVisitors = (visitors || []).filter((v) => {
    if (!v) return false;
    const s = (visitorSearch || '').toLowerCase();
    const matchesSearch =
      !s ||
      (v.name || '').toLowerCase().includes(s) ||
      (v.company || '').toLowerCase().includes(s) ||
      (v.purpose || '').toLowerCase().includes(s) ||
      (v.badgeNumber || '').toLowerCase().includes(s);
    const matchesStatus =
      visitorFilter === 'ALL' || v.status === visitorFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCheckoutVisitor = async (id) => {
    await offlineVisitorService.checkoutVisitor(id);
    const updated = await offlineVisitorService.getVisitors();
    setVisitors(updated);
    showStatus('Visitor checked out successfully');
  };

  const handleDeleteVisitor = async (id, visitorName) => {
    if (window.confirm(`Delete visitor record for "${visitorName}"?`)) {
      await offlineVisitorService.deleteVisitor(id);
      setVisitors((prev) => prev.filter((item) => item.id !== id));
      showStatus(`Deleted visitor record for ${visitorName}`);
    }
  };

  const handleExportVisitorsCSV = async () => {
    try {
      const csvContent = await offlineVisitorService.exportVisitorsCSV();
      if (!csvContent) {
        alert('No visitor records to export.');
        return;
      }
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `aurra_visitors_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showStatus('Exported visitors to CSV');
    } catch (err) {
      logger.error('ADMIN', `Failed to export CSV: ${err.message}`);
      showStatus('Failed to export CSV');
    }
  };

  // ── WebLinks & QR Code Handlers ──
  useEffect(() => {
    let cancelled = false;
    const generateAll = async () => {
      const map = {};
      for (const item of weblinks) {
        try {
          const url = await QRCode.toDataURL(item.url || 'https://robomiracle.com', {
            width: 140,
            margin: 1.5,
            color: {
              dark: item.tagColor || '#00ffff',
              light: '#051020',
            },
            errorCorrectionLevel: 'M',
          });
          map[item.id] = url;
        } catch {}
      }
      if (!cancelled) setAdminQrMap(map);
    };
    if (weblinks.length > 0) {
      generateAll();
    }
    return () => {
      cancelled = true;
    };
  }, [weblinks]);

  // Live QR generation in modal
  useEffect(() => {
    if (!formUrl || !formUrl.trim() || formUrl.trim() === 'https://') {
      setFormPreviewQr('');
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(formUrl.trim(), {
      width: 200,
      margin: 1.5,
      color: {
        dark: formTagColor || '#00ffff',
        light: '#030c17',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (!cancelled) setFormPreviewQr(url);
      })
      .catch(() => {
        if (!cancelled) setFormPreviewQr('');
      });

    return () => {
      cancelled = true;
    };
  }, [formUrl, formTagColor]);

  const handleOpenAddLink = () => {
    setModalMode('add');
    setFormId('');
    setFormTitle('');
    setFormSubtitle('');
    setFormUrl('https://');
    setFormDisplayUrl('');
    setFormCategory('web');
    setFormDescription('');
    setFormTag('OFFICIAL PORTAL');
    setFormTagColor('#00ffff');
    setFormAccentColor('#00D5FF');
    setFormBadge('Verified Official');
    setFormIsEnabled(true);
    setFormHasInKioskPreview(false);
    setShowLinkModal(true);
  };

  const handleOpenEditLink = (link) => {
    setModalMode('edit');
    setFormId(link.id);
    setFormTitle(link.title || '');
    setFormSubtitle(link.subtitle || '');
    setFormUrl(link.url || '');
    setFormDisplayUrl(link.displayUrl || '');
    setFormCategory(link.category || 'web');
    setFormDescription(link.description || '');
    setFormTag(link.tag || 'OFFICIAL LINK');
    setFormTagColor(link.tagColor || '#00ffff');
    setFormAccentColor(link.accentColor || '#00D5FF');
    setFormBadge(link.badge || 'Verified');
    setFormIsEnabled(link.isEnabled !== false);
    setFormHasInKioskPreview(!!link.hasInKioskPreview);
    setShowLinkModal(true);
  };

  const handleCloseLinkModal = () => {
    setShowLinkModal(false);
  };

  const handleSaveLink = async (e) => {
    e?.preventDefault();
    if (!formTitle.trim()) {
      showStatus('Please enter a portal title');
      return;
    }
    if (!formUrl.trim() || formUrl.trim() === 'https://') {
      showStatus('Please enter a valid target URL');
      return;
    }

    try {
      const payload = {
        title: formTitle.trim(),
        subtitle: formSubtitle.trim(),
        url: formUrl.trim(),
        displayUrl: formDisplayUrl.trim() || formUrl.trim().replace(/^https?:\/\//i, '').replace(/\/$/, ''),
        category: formCategory,
        description: formDescription.trim(),
        tag: formTag.trim() || 'OFFICIAL LINK',
        tagColor: formTagColor,
        accentColor: formAccentColor,
        badge: formBadge.trim() || 'Verified',
        isEnabled: formIsEnabled,
        hasInKioskPreview: formHasInKioskPreview,
      };

      if (modalMode === 'add') {
        const added = await offlineWebLinksService.addWebLink(payload);
        setWeblinks((prev) => [...prev, added]);
        showStatus(`Added QR portal: "${added.title}"`);
        logger.info('ADMIN', `Created new QR link portal: ${added.title}`);
      } else {
        const updated = await offlineWebLinksService.updateWebLink(formId, payload);
        setWeblinks((prev) => prev.map((l) => (l.id === formId ? updated : l)));
        showStatus(`Updated QR portal: "${updated.title}"`);
        logger.info('ADMIN', `Updated QR link portal: ${updated.title}`);
      }
      setShowLinkModal(false);
    } catch (err) {
      showStatus(`Error saving portal: ${err.message}`);
    }
  };

  const handleToggleLinkActive = async (link) => {
    const nextVal = !link.isEnabled;
    await offlineWebLinksService.toggleWebLinkEnabled(link.id, nextVal);
    setWeblinks((prev) => prev.map((l) => (l.id === link.id ? { ...l, isEnabled: nextVal } : l)));
    showStatus(`Portal "${link.title}": ${nextVal ? 'ACTIVE ON KIOSK' : 'HIDDEN FROM KIOSK'}`);
  };

  const handleDeleteLink = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete the QR portal "${title}"?`)) return;
    await offlineWebLinksService.deleteWebLink(id);
    setWeblinks((prev) => prev.filter((l) => l.id !== id));
    showStatus(`Deleted portal "${title}"`);
    logger.info('ADMIN', `Deleted QR link portal: ${title} (${id})`);
  };

  const handleResetLinks = async () => {
    if (!window.confirm('Reset all QR Code portals and links back to factory defaults? Any custom added portals will be removed.')) return;
    const restored = await offlineWebLinksService.resetToDefaults();
    setWeblinks(restored || []);
    showStatus('QR portals reset to factory defaults');
    logger.info('ADMIN', 'Reset QR portals to default');
  };

  // ── Guided Robot Tour Handlers ──
  const handleOpenAddTourStop = () => {
    setTourModalMode('add');
    setTourFormId('');
    setTourFormName('');
    setTourFormArea('');
    setTourFormNarration('');
    setTourFormDuration(12);
    setTourFormHighlights('');
    setTourFormRgb('#00FFFF');
    setTourFormTilt(90);
    setTourFormPan(90);
    setTourFormMapX(50);
    setTourFormMapY(50);
    setShowTourModal(true);
  };

  const handleOpenEditTourStop = (stop) => {
    setTourModalMode('edit');
    setTourFormId(stop.id);
    setTourFormName(stop.name || '');
    setTourFormArea(stop.area || '');
    setTourFormNarration(stop.narration || '');
    setTourFormDuration(stop.durationSec || 12);
    setTourFormHighlights(Array.isArray(stop.highlights) ? stop.highlights.join(', ') : (stop.highlights || ''));
    setTourFormRgb(stop.rgbColor || '#00FFFF');
    setTourFormTilt(stop.servoTilt ?? 90);
    setTourFormPan(stop.servoPan ?? 90);
    setTourFormMapX(stop.mapX ?? 50);
    setTourFormMapY(stop.mapY ?? 50);
    setShowTourModal(true);
  };

  const handleSaveTourStop = async (e) => {
    e?.preventDefault();
    if (!tourFormName.trim()) {
      showStatus('Waypoint name is required');
      return;
    }

    try {
      const stopData = {
        name: tourFormName.trim(),
        area: tourFormArea.trim(),
        narration: tourFormNarration.trim(),
        durationSec: Number(tourFormDuration) || 12,
        highlights: tourFormHighlights.split(',').map((h) => h.trim()).filter(Boolean),
        rgbColor: tourFormRgb,
        servoTilt: Number(tourFormTilt),
        servoPan: Number(tourFormPan),
        mapX: Number(tourFormMapX),
        mapY: Number(tourFormMapY),
      };

      if (tourModalMode === 'edit' && tourFormId) {
        await offlineTourService.updateStop(tourFormId, stopData);
        showStatus('Tour waypoint updated!');
      } else {
        await offlineTourService.addStop(stopData);
        showStatus('New tour waypoint added!');
      }

      setShowTourModal(false);
      const updated = await offlineTourService.getStops();
      setTourStops(updated || []);
    } catch (err) {
      showStatus(`Failed to save waypoint: ${err.message}`);
    }
  };

  const handleDeleteTourStop = async (id, name) => {
    if (window.confirm(`Delete tour waypoint "${name}"?`)) {
      try {
        await offlineTourService.deleteStop(id);
        const updated = await offlineTourService.getStops();
        setTourStops(updated || []);
        showStatus(`Deleted waypoint: ${name}`);
      } catch (err) {
        showStatus(`Delete failed: ${err.message}`);
      }
    }
  };

  const handleToggleTourStopEnabled = async (id, currentEnabled) => {
    try {
      await offlineTourService.toggleStopEnabled(id, !currentEnabled);
      const updated = await offlineTourService.getStops();
      setTourStops(updated || []);
    } catch (err) {
      showStatus(`Toggle failed: ${err.message}`);
    }
  };

  const handleMoveTourStop = async (index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= tourStops.length) return;

    const newStops = [...tourStops];
    const [moved] = newStops.splice(index, 1);
    newStops.splice(targetIndex, 0, moved);

    const orderedIds = newStops.map((s) => s.id);
    const updated = await offlineTourService.reorderStops(orderedIds);
    setTourStops(updated || []);
    showStatus('Waypoint order updated!');
  };

  const handleResetTourStops = async () => {
    if (window.confirm('Reset all tour waypoints to default 5 facility stops?')) {
      try {
        const restored = await offlineTourService.restoreDefaultStops();
        setTourStops(restored || []);
        showStatus('Restored default tour waypoints!');
      } catch (err) {
        showStatus(`Restore failed: ${err.message}`);
      }
    }
  };

  const handleTestTourSpeech = (stop) => {
    if (!stop?.narration) return;
    setTourTestingSpeechId(stop.id);
    speakWithVoice(stop.narration, {
      onEnd: () => setTourTestingSpeechId(null),
    });
  };

  const handleTestModalSpeech = () => {
    if (!tourFormNarration?.trim()) {
      showStatus('Enter narration text first');
      return;
    }
    setTourTestingSpeechId('modal');
    speakWithVoice(tourFormNarration, {
      onEnd: () => setTourTestingSpeechId(null),
    });
  };

  // ── Robomiracle Classic Robot Showcase Handlers ──
  const handleOpenAddRobot = () => {
    setRobotModalMode('add');
    setRobotFormId('');
    setRobotFormTitle('');
    setRobotFormSubtitle('');
    setRobotFormSlug('');
    setRobotFormBadge('Autonomous Robot');
    setRobotFormImage('/aurra/hero.webp');
    setShowRobotModal(true);
  };

  const handleOpenEditRobot = (robot) => {
    setRobotModalMode('edit');
    setRobotFormId(robot.id);
    setRobotFormTitle(robot.title || '');
    setRobotFormSubtitle(robot.subtitle || '');
    setRobotFormSlug(robot.slug || '');
    setRobotFormBadge(robot.badge || 'Robotics');
    setRobotFormImage(robot.image || '/aurra/hero.webp');
    setShowRobotModal(true);
  };

  const handleSaveRobot = async (e) => {
    e?.preventDefault();
    if (!robotFormTitle.trim()) {
      showStatus('Robot title is required');
      return;
    }

    try {
      const data = {
        title: robotFormTitle.trim(),
        subtitle: robotFormSubtitle.trim(),
        slug: robotFormSlug.trim() || robotFormTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        badge: robotFormBadge.trim(),
        image: robotFormImage.trim() || '/aurra/hero.webp',
      };

      if (robotModalMode === 'edit' && robotFormId) {
        await offlineRobotTourService.updateRobot(robotFormId, data);
        showStatus('Robot details updated!');
      } else {
        await offlineRobotTourService.addRobot(data);
        showStatus('New robot added to tour showcase!');
      }

      setShowRobotModal(false);
      const updated = await offlineRobotTourService.getRobots();
      setRobotTours(updated || []);
      if (selectedRobotForSteps) {
        const fresh = await offlineRobotTourService.getRobotById(selectedRobotForSteps.id);
        setSelectedRobotForSteps(fresh || null);
      }
    } catch (err) {
      showStatus(`Failed to save robot: ${err.message}`);
    }
  };

  const handleDeleteRobot = async (id, title) => {
    if (window.confirm(`Delete robot "${title}" and all its tour steps?`)) {
      try {
        await offlineRobotTourService.deleteRobot(id);
        const updated = await offlineRobotTourService.getRobots();
        setRobotTours(updated || []);
        if (selectedRobotForSteps?.id === id) {
          setSelectedRobotForSteps(null);
        }
        showStatus(`Deleted robot: ${title}`);
      } catch (err) {
        showStatus(`Delete failed: ${err.message}`);
      }
    }
  };

  const handleToggleRobotEnabled = async (id, currentEnabled) => {
    try {
      await offlineRobotTourService.toggleRobotEnabled(id, !currentEnabled);
      const updated = await offlineRobotTourService.getRobots();
      setRobotTours(updated || []);
    } catch (err) {
      showStatus(`Toggle failed: ${err.message}`);
    }
  };

  const handleMoveRobot = async (index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= robotTours.length) return;

    const newRobots = [...robotTours];
    const [moved] = newRobots.splice(index, 1);
    newRobots.splice(targetIndex, 0, moved);

    const orderedIds = newRobots.map((r) => r.id);
    const updated = await offlineRobotTourService.reorderRobots(orderedIds);
    setRobotTours(updated || []);
    showStatus('Robot order updated!');
  };

  const handleResetRobotTours = async () => {
    if (window.confirm('Reset all robot showcase tours and steps to factory defaults?')) {
      try {
        const restored = await offlineRobotTourService.restoreDefaultRobots();
        setRobotTours(restored || []);
        setSelectedRobotForSteps(null);
        showStatus('Restored default robots and 5-step presentations!');
      } catch (err) {
        showStatus(`Restore failed: ${err.message}`);
      }
    }
  };

  // Step Editing Handlers
  const handleOpenAddStep = () => {
    if (!selectedRobotForSteps) return;
    setStepModalMode('add');
    setStepFormIndex(null);
    setStepFormName(`Step ${(selectedRobotForSteps.steps?.length || 0) + 1}`);
    setStepFormIntro('');
    setStepFormMainContent('');
    setStepFormThankYou('');
    setStepFormImage(selectedRobotForSteps.image || '/aurra/hero.webp');
    setShowStepModal(true);
  };

  const handleOpenEditStep = (step, index) => {
    setStepModalMode('edit');
    setStepFormIndex(index);
    setStepFormName(step.stepName || `Step ${index + 1}`);
    setStepFormIntro(step.intro || '');
    setStepFormMainContent(step.mainContent || '');
    setStepFormThankYou(step.thankYou || '');
    setStepFormImage(step.image || selectedRobotForSteps?.image || '');
    setShowStepModal(true);
  };

  const handleSaveStep = async (e) => {
    e?.preventDefault();
    if (!selectedRobotForSteps) return;
    if (!stepFormName.trim()) {
      showStatus('Step name is required');
      return;
    }

    try {
      const currentSteps = [...(selectedRobotForSteps.steps || [])];
      const stepData = {
        stepName: stepFormName.trim(),
        intro: stepFormIntro.trim(),
        mainContent: stepFormMainContent.trim(),
        thankYou: stepFormThankYou.trim(),
        image: stepFormImage.trim() || selectedRobotForSteps.image || '/aurra/hero.webp',
      };

      if (stepModalMode === 'edit' && stepFormIndex !== null) {
        currentSteps[stepFormIndex] = { ...currentSteps[stepFormIndex], ...stepData };
      } else {
        currentSteps.push(stepData);
      }

      const updatedRobot = await offlineRobotTourService.saveRobotSteps(selectedRobotForSteps.id, currentSteps);
      setSelectedRobotForSteps(updatedRobot);
      setShowStepModal(false);

      const all = await offlineRobotTourService.getRobots();
      setRobotTours(all || []);
      showStatus('Tour step saved successfully!');
    } catch (err) {
      showStatus(`Failed to save step: ${err.message}`);
    }
  };

  const handleDeleteStep = async (index) => {
    if (!selectedRobotForSteps) return;
    if (window.confirm('Delete this tour step?')) {
      try {
        const currentSteps = [...(selectedRobotForSteps.steps || [])];
        currentSteps.splice(index, 1);
        const updatedRobot = await offlineRobotTourService.saveRobotSteps(selectedRobotForSteps.id, currentSteps);
        setSelectedRobotForSteps(updatedRobot);
        const all = await offlineRobotTourService.getRobots();
        setRobotTours(all || []);
        showStatus('Step deleted');
      } catch (err) {
        showStatus(`Delete failed: ${err.message}`);
      }
    }
  };

  const handleMoveStep = async (index, direction) => {
    if (!selectedRobotForSteps) return;
    const steps = [...(selectedRobotForSteps.steps || [])];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= steps.length) return;

    const [moved] = steps.splice(index, 1);
    steps.splice(targetIndex, 0, moved);

    const updatedRobot = await offlineRobotTourService.saveRobotSteps(selectedRobotForSteps.id, steps);
    setSelectedRobotForSteps(updatedRobot);
    const all = await offlineRobotTourService.getRobots();
    setRobotTours(all || []);
    showStatus('Step order updated');
  };

  const handleTestStepSpeech = (text, phaseKey) => {
    if (!text?.trim()) {
      showStatus('No text for this speech phase');
      return;
    }
    setTestingStepPhase(phaseKey);
    speakWithVoice(text, {
      onEnd: () => setTestingStepPhase(null),
      onError: () => setTestingStepPhase(null),
    });
  };

  // ── Real AI LLM Handlers ──
  const handleToggleLlmEnabled = () => {
    const updated = !llmConfig.enabled;
    const next = llmService.saveConfig({ enabled: updated });
    setLlmConfig(next);
    showStatus(`Real AI LLM: ${updated ? 'ENABLED' : 'DISABLED'}`);
  };

  const handleSaveLlmApiKey = (newKey) => {
    const next = llmService.saveConfig({ apiKey: newKey.trim() });
    setLlmConfig(next);
    showStatus('LLM API Key saved successfully');
  };

  const handleSaveLlmApiUrl = (newUrl) => {
    const next = llmService.saveConfig({ apiUrl: newUrl.trim() });
    setLlmConfig(next);
    showStatus('LLM API Base URL saved successfully');
  };

  const handleSelectLlmModel = (newModel) => {
    const next = llmService.saveConfig({ model: newModel });
    setLlmConfig(next);
    showStatus(`AI Model changed to "${newModel}"`);
  };

  const handleSaveLlmSystemPrompt = (newPrompt) => {
    const next = llmService.saveConfig({ systemPrompt: newPrompt.trim() });
    setLlmConfig(next);
    showStatus('System Persona & Prompt saved');
  };

  const handleResetLlmSystemPrompt = () => {
    const defaultConfig = llmService.saveConfig({ systemPrompt: undefined });
    setLlmConfig(defaultConfig);
    setLlmSystemPromptInput(defaultConfig.systemPrompt || DEFAULT_SYSTEM_PROMPT);
    showStatus('System Persona reset to baseline with Facilities & Tours');
  };

  const handleSyncPromptWithKnowledge = async () => {
    try {
      const liveBlock = await getLiveKnowledgeBlock(true);
      const merged = mergeKnowledgeIntoPrompt(llmSystemPromptInput || llmConfig.systemPrompt || DEFAULT_SYSTEM_PROMPT, liveBlock);
      setLlmSystemPromptInput(merged);
      const next = llmService.saveConfig({ systemPrompt: merged });
      setLlmConfig(next);
      showStatus('Auto-merged latest campus facilities & tours into prompt!');
    } catch (err) {
      showStatus(`Sync error: ${err.message}`);
    }
  };

  const handleUpdateLlmParams = (params) => {
    const next = llmService.saveConfig(params);
    setLlmConfig(next);
    showStatus('LLM Hyper-parameters updated');
  };

  const handleTestAiQuery = async (queryToTest) => {
    const q = (queryToTest || testAiCustomQuery).trim();
    if (!q) return;
    setTestAiLoading(true);
    setTestAiResult(null);
    try {
      const res = await llmService.generateResponse(q);
      setTestAiResult(res);
      if (res.success) {
        showStatus(`AI Response received in ${res.latencyMs}ms!`);
      } else {
        showStatus(`AI Call Failed: ${res.reason || res.error}`);
      }
    } catch (err) {
      setTestAiResult({ success: false, error: err.message });
      showStatus(`AI Call Failed: ${err.message}`);
    } finally {
      setTestAiLoading(false);
    }
  };

  const filteredWeblinks = weblinks.filter((link) => {
    const matchesCat = weblinksCategoryFilter === 'ALL' || link.category === weblinksCategoryFilter;
    const q = weblinksSearch.toLowerCase().trim();
    const matchesQ =
      !q ||
      link.title?.toLowerCase().includes(q) ||
      link.subtitle?.toLowerCase().includes(q) ||
      link.url?.toLowerCase().includes(q) ||
      link.tag?.toLowerCase().includes(q) ||
      link.description?.toLowerCase().includes(q);
    return matchesCat && matchesQ;
  });

  // Facility management handlers
  const handleToggleFacility = async (id, isEnabled) => {
    try {
      await offlineFacilityService.toggleFacilityEnabled(id, isEnabled);
      setFacilities((prev) => prev.map((f) => (f.id === id ? { ...f, isEnabled } : f)));
      showStatus(`Facility ${isEnabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      showStatus(`Error updating facility: ${err.message}`);
    }
  };

  const handleDeleteFacility = async (id, name) => {
    if (!window.confirm(`Delete facility "${name}"?`)) return;
    try {
      await offlineFacilityService.deleteFacility(id);
      setFacilities((prev) => prev.filter((f) => f.id !== id));
      showStatus(`Deleted "${name}"`);
    } catch (err) {
      showStatus(`Error deleting facility: ${err.message}`);
    }
  };

  const handleOpenAddFacility = () => {
    setFacilityModalMode('add');
    setFacilityForm({
      id: `fac-${Date.now()}`,
      code: `G-0${facilities.length + 1}`,
      name: '',
      floor: 'ground',
      floorLabel: 'Ground Floor (Level 0)',
      wing: 'East Wing',
      category: 'reception',
      categoryLabel: 'Reception & Check-In',
      icon: 'Building2',
      hours: '9:00 AM – 6:00 PM',
      distanceMeters: 20,
      walkTime: '30 sec walk',
      status: 'Open',
      directions: '',
      amenities: 'Wi-Fi, Accessible',
    });
    setShowFacilityModal(true);
  };

  const handleOpenEditFacility = (fac) => {
    setFacilityModalMode('edit');
    setFacilityForm({
      ...fac,
      amenities: Array.isArray(fac.amenities) ? fac.amenities.join(', ') : (fac.amenities || ''),
    });
    setShowFacilityModal(true);
  };

  const handleSaveFacility = async (e) => {
    e.preventDefault();
    try {
      const amenitiesArray = typeof facilityForm.amenities === 'string'
        ? facilityForm.amenities.split(',').map((s) => s.trim()).filter(Boolean)
        : (facilityForm.amenities || []);

      const floorLabel =
        facilityForm.floor === 'ground' ? 'Ground Floor (Level 0)' :
        facilityForm.floor === 'first' ? 'First Floor (Level 1)' :
        facilityForm.floor === 'second' ? 'Second Floor (Level 2)' : 'Outdoor / Campus';

      const payload = {
        ...facilityForm,
        floorLabel,
        amenities: amenitiesArray,
        distanceMeters: Number(facilityForm.distanceMeters) || 0,
        sortOrder: facilityForm.sortOrder || facilities.length + 1,
      };

      if (facilityModalMode === 'add') {
        await offlineFacilityService.addFacility(payload);
        showStatus(`Added facility "${payload.name}"`);
      } else {
        await offlineFacilityService.updateFacility(payload.id, payload);
        showStatus(`Updated facility "${payload.name}"`);
      }

      const refreshed = await offlineFacilityService.getFacilities();
      setFacilities(refreshed);
      setShowFacilityModal(false);
    } catch (err) {
      showStatus(`Failed saving facility: ${err.message}`);
    }
  };

  const handleResetFacilities = async () => {
    if (!window.confirm('Reset all facilities and directories to factory defaults? Any custom rooms will be reverted.')) return;
    try {
      const reset = await offlineFacilityService.restoreDefaultFacilities();
      setFacilities(reset);
      showStatus('Restored campus facilities to factory defaults');
    } catch (err) {
      showStatus(`Reset failed: ${err.message}`);
    }
  };

  const filteredFacilitiesAdmin = facilities.filter((fac) => {
    const matchesFloor = facilityFloorFilter === 'all' || fac.floor === facilityFloorFilter;
    const q = facilitySearch.toLowerCase().trim();
    const matchesQ =
      !q ||
      fac.name?.toLowerCase().includes(q) ||
      fac.title?.toLowerCase().includes(q) ||
      fac.description?.toLowerCase().includes(q) ||
      fac.code?.toLowerCase().includes(q) ||
      fac.wing?.toLowerCase().includes(q) ||
      fac.categoryLabel?.toLowerCase().includes(q) ||
      fac.directions?.toLowerCase().includes(q);
    return matchesFloor && matchesQ;
  });

  return (
    <div className="adm-dashboard-root">
      {/* ── Left Sidebar Navigation ── */}
      <aside className="adm-dashboard-sidebar">
        <div className="adm-sidebar-brand-box">
          <div className="adm-brand-avatar">
            <Bot size={26} color="#ffffff" />
          </div>
          <div className="adm-brand-text">
            <h2>Aurra Admin</h2>
            <span>System Manager</span>
          </div>
        </div>

        <div className="adm-sidebar-divider" />

        <nav className="adm-sidebar-menu">
          <div className="adm-menu-group-label">MAIN</div>
          <button
            className={`adm-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <LayoutDashboard size={18} />
            <span>Overview</span>
          </button>

          <div className="adm-menu-group-label">CONTENT</div>
          <button
            className={`adm-nav-item ${activeTab === 'branding' ? 'active' : ''}`}
            onClick={() => setActiveTab('branding')}
          >
            <LayoutTemplate size={18} />
            <span>Header & Branding</span>
          </button>
          <button
            className={`adm-nav-item ${activeTab === 'cards' ? 'active' : ''}`}
            onClick={() => setActiveTab('cards')}
          >
            <CreditCard size={18} />
            <span>Action Cards</span>
          </button>
          <button
            className={`adm-nav-item ${activeTab === 'slides' ? 'active' : ''}`}
            onClick={() => setActiveTab('slides')}
          >
            <ImageIcon size={18} />
            <span>Slideshow Banners</span>
          </button>

          <div className="adm-menu-group-label">AI & ROBOT CONFIG</div>
          <button
            className={`adm-nav-item ${activeTab === 'voice' ? 'active' : ''}`}
            onClick={() => setActiveTab('voice')}
          >
            <Volume2 size={18} />
            <span>Voice & Audio</span>
          </button>

          <button
            className={`adm-nav-item dev-highlight ${activeTab === 'ai-llm' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai-llm')}
          >
            <Sparkles size={18} color="#c084fc" />
            <span>Real AI Grok LLM & API</span>
          </button>
          <button
            className={`adm-nav-item dev-highlight ${activeTab === 'chat-history' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat-history')}
          >
            <MessageSquare size={18} color="#00ffff" />
            <span>Chat History & Transcripts</span>
          </button>
          <button
            className={`adm-nav-item ${activeTab === 'questions' ? 'active' : ''}`}
            onClick={() => setActiveTab('questions')}
          >
            <HelpCircle size={18} />
            <span>Q&A Knowledge Base</span>
          </button>
          <button
            className={`adm-nav-item ${activeTab === 'faces' ? 'active' : ''}`}
            onClick={() => setActiveTab('faces')}
          >
            <Smile size={18} />
            <span>Face Greetings & Vision</span>
          </button>
          <button
            className={`adm-nav-item ${activeTab === 'visitors' ? 'active' : ''}`}
            onClick={() => setActiveTab('visitors')}
          >
            <Users size={18} />
            <span>Visitor Directory</span>
            {visitors.length > 0 && <span className="adm-nav-badge">{visitors.length}</span>}
          </button>
          <button
            className={`adm-nav-item ${activeTab === 'registration' ? 'active' : ''}`}
            onClick={() => setActiveTab('registration')}
          >
            <UserCheck size={18} />
            <span>Registration & Badges</span>
          </button>
          <button
            className={`adm-nav-item ${activeTab === 'tour' ? 'active' : ''}`}
            onClick={() => setActiveTab('tour')}
          >
            <Compass size={18} />
            <span>Guided Robot Tour</span>
            {tourStops.length > 0 && <span className="adm-nav-badge">{tourStops.length}</span>}
          </button>
          <button
            className={`adm-nav-item ${activeTab === 'hardware' ? 'active' : ''}`}
            onClick={() => setActiveTab('hardware')}
          >
            <Wifi size={18} />
            <span>Hardware & Control</span>
          </button>
          <button
            className={`adm-nav-item ${activeTab === 'weblinks' ? 'active' : ''}`}
            onClick={() => setActiveTab('weblinks')}
          >
            <QrCode size={18} />
            <span>QR Codes & Links</span>
            {weblinks.length > 0 && <span className="adm-nav-badge">{weblinks.length}</span>}
          </button>
          <button
            className={`adm-nav-item ${activeTab === 'facilities' ? 'active' : ''}`}
            onClick={() => setActiveTab('facilities')}
          >
            <Building2 size={18} />
            <span>Campus Facilities & Rooms</span>
            {facilities.length > 0 && <span className="adm-nav-badge">{facilities.length}</span>}
          </button>

          <div className="adm-menu-group-label">DEVELOPER & SYSTEM</div>
          <button
            className={`adm-nav-item dev-highlight ${activeTab === 'developer' ? 'active' : ''}`}
            onClick={() => setActiveTab('developer')}
          >
            <Sliders size={18} />
            <span>Developer & PIN Security</span>
          </button>
          <button
            className={`adm-nav-item ${activeTab === 'backup' ? 'active' : ''}`}
            onClick={() => setActiveTab('backup')}
          >
            <Database size={18} />
            <span>Backup & System</span>
          </button>
        </nav>

        <div className="adm-sidebar-bottom">
          <div className="adm-sidebar-divider" />
          <button
            className="adm-exit-btn"
            onClick={() => {
              if (onClose) onClose();
              else if (onNavigate) onNavigate('/');
            }}
          >
            <LogOut size={18} />
            <span>Exit to Kiosk</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <main className="adm-dashboard-main">
        {/* Top Bar with Toast Alert */}
        <header className="adm-main-topbar">
          <div className="adm-topbar-title-wrap">
            <span className="adm-badge-role">ADMINISTRATOR MODE</span>
            <h1 className="adm-topbar-title">
              {activeTab === 'overview' && 'System Overview & Telemetry'}
              {activeTab === 'branding' && 'Kiosk Header & Organization Branding'}
              {activeTab === 'cards' && 'Action Cards & Voice Access Matrix'}
              {activeTab === 'slides' && 'Home Screen Slideshow Banners'}
              {activeTab === 'voice' && 'Universal Voice Assistant & Audio Customization'}
              {activeTab === 'ai-llm' && 'Real AI Grok Cloud API & LLM Intelligence Settings'}
              {activeTab === 'chat-history' && 'AI Chat Transcripts & Interaction History'}
              {activeTab === 'questions' && 'Q&A Knowledge Base for Voice & Text'}
              {activeTab === 'faces' && 'Face Recognition, Vision & Greeting Setup'}
              {activeTab === 'visitors' && 'Visitor Directory & Admission Logs'}
              {activeTab === 'registration' && 'Visitor Registration & Admission Badge Customization'}
              {activeTab === 'tour' && 'Guided Robot Tour & Facility Waypoints'}
              {activeTab === 'hardware' && 'Robot Hardware, Servo Poses & Wi-Fi Setup'}
              {activeTab === 'weblinks' && 'QR Codes & Official Portals Manager'}
              {activeTab === 'facilities' && 'Public Facilities & Room Directory Management'}
              {activeTab === 'developer' && 'Developer Mode, PIN Security & System Toggles'}
              {activeTab === 'backup' && 'Database Backup, JSON Export & Reset'}
            </h1>
          </div>

          <div className="adm-topbar-right">
            {statusMsg && (
              <div className="adm-toast-pill">
                <Check size={16} />
                <span>{statusMsg}</span>
              </div>
            )}
            <button
              className="adm-kiosk-back-btn"
              onClick={() => {
                if (onClose) onClose();
                else if (onNavigate) onNavigate('/');
              }}
            >
              <span>Back to Home</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </header>

        {/* ── Tab Views ── */}
        <div className="adm-tab-scroll-container">
          {/* 1. OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="adm-tab-panel">
              <div className="adm-metric-grid">
                <div className="adm-metric-card" onClick={() => setActiveTab('cards')}>
                  <div className="adm-metric-icon bg-cyan">
                    <CreditCard size={24} />
                  </div>
                  <div className="adm-metric-data">
                    <span className="adm-metric-num">{cards.length}</span>
                    <span className="adm-metric-label">Action Cards</span>
                  </div>
                  <span className="adm-metric-sub">{cards.filter((c) => c.isEnabled).length} active on kiosk</span>
                </div>

                <div className="adm-metric-card" onClick={() => setActiveTab('slides')}>
                  <div className="adm-metric-icon bg-purple">
                    <ImageIcon size={24} />
                  </div>
                  <div className="adm-metric-data">
                    <span className="adm-metric-num">{slides.length}</span>
                    <span className="adm-metric-label">Banner Slides</span>
                  </div>
                  <span className="adm-metric-sub">{slides.filter((s) => s.isSelected).length} rotating</span>
                </div>

                <div className="adm-metric-card" onClick={() => setActiveTab('questions')}>
                  <div className="adm-metric-icon bg-green">
                    <HelpCircle size={24} />
                  </div>
                  <div className="adm-metric-data">
                    <span className="adm-metric-num">{questions.length}</span>
                    <span className="adm-metric-label">Knowledge Q&As</span>
                  </div>
                  <span className="adm-metric-sub">Universal offline AI answers</span>
                </div>

                <div className="adm-metric-card" onClick={() => setActiveTab('hardware')}>
                  <div className={`adm-metric-icon ${espStatus.connected ? 'bg-cyan' : 'bg-orange'}`}>
                    <Wifi size={24} />
                  </div>
                  <div className="adm-metric-data">
                    <span className="adm-metric-num">{espStatus.connected ? 'ONLINE' : 'STANDBY'}</span>
                    <span className="adm-metric-label">ESP32 Hardware</span>
                  </div>
                  <span className="adm-metric-sub">{espStatus.ip || '192.168.4.1'}</span>
                </div>

                <div className="adm-metric-card" onClick={() => setActiveTab('visitors')}>
                  <div className="adm-metric-icon bg-cyan">
                    <Users size={24} />
                  </div>
                  <div className="adm-metric-data">
                    <span className="adm-metric-num">{visitors.length}</span>
                    <span className="adm-metric-label">Visitors</span>
                  </div>
                  <span className="adm-metric-sub">{visitors.filter((v) => v.status === 'ACTIVE').length} currently active</span>
                </div>

                <div className="adm-metric-card" onClick={() => setActiveTab('weblinks')}>
                  <div className="adm-metric-icon bg-cyan">
                    <QrCode size={24} />
                  </div>
                  <div className="adm-metric-data">
                    <span className="adm-metric-num">{weblinks.length}</span>
                    <span className="adm-metric-label">QR Portals</span>
                  </div>
                  <span className="adm-metric-sub">{weblinks.filter((l) => l.isEnabled).length} active on kiosk</span>
                </div>

                <div className="adm-metric-card" onClick={() => setActiveTab('tour')}>
                  <div className="adm-metric-icon bg-cyan">
                    <Compass size={24} />
                  </div>
                  <div className="adm-metric-data">
                    <span className="adm-metric-num">{tourStops.length}</span>
                    <span className="adm-metric-label">Tour Waypoints</span>
                  </div>
                  <span className="adm-metric-sub">{tourStops.filter((s) => s.isEnabled).length} active facility stops</span>
                </div>

                <div className="adm-metric-card" onClick={() => setActiveTab('voice')}>
                  <div className="adm-metric-icon bg-purple">
                    <Volume2 size={24} />
                  </div>
                  <div className="adm-metric-data">
                    <span className="adm-metric-num">{(kioskConfig.voiceGender || 'female').toUpperCase()}</span>
                    <span className="adm-metric-label">Voice Assistant</span>
                  </div>
                  <span className="adm-metric-sub">{kioskConfig.speechRate}x speed</span>
                </div>

                <div className="adm-metric-card" onClick={() => setActiveTab('ai-llm')}>
                  <div className="adm-metric-icon bg-purple">
                    <Sparkles size={24} color="#c084fc" />
                  </div>
                  <div className="adm-metric-data">
                    <span className="adm-metric-num">{llmConfig.enabled ? 'GROK AI' : 'OFFLINE'}</span>
                    <span className="adm-metric-label">Real AI LLM Engine</span>
                  </div>
                  <span className="adm-metric-sub">{llmConfig.enabled ? `Active • ${llmConfig.model || 'Llama 70B'}` : 'Tap to Configure Key'}</span>
                </div>

                <div className="adm-metric-card" onClick={() => setActiveTab('registration')}>
                  <div className="adm-metric-icon bg-green">
                    <UserCheck size={24} />
                  </div>
                  <div className="adm-metric-data">
                    <span className="adm-metric-num">BADGE AI</span>
                    <span className="adm-metric-label">Registration Policy</span>
                  </div>
                  <span className="adm-metric-sub">{kioskConfig.badgeIdPrefix || 'AUR-VIS'} • Photo {kioskConfig.requireVisitorPhoto ? 'REQ' : 'OPT'}</span>
                </div>

                <div className="adm-metric-card" onClick={() => setActiveTab('chat-history')}>
                  <div className="adm-metric-icon" style={{ background: 'rgba(0, 255, 255, 0.12)', border: '1px solid rgba(0, 255, 255, 0.3)' }}>
                    <MessageSquare size={24} color="#00ffff" />
                  </div>
                  <div className="adm-metric-data">
                    <span className="adm-metric-num" style={{ color: '#00ffff' }}>TRANSCRIPTS</span>
                    <span className="adm-metric-label">Chat & Voice Log</span>
                  </div>
                  <span className="adm-metric-sub">ChatGPT Viewer • Audio & Text</span>
                </div>
              </div>

              {/* Quick Actions Panel */}
              <div className="adm-card-panel">
                <h3 className="adm-panel-title">System Quick Access</h3>
                <div className="adm-quick-actions-row">
                  <button className="adm-btn-action" onClick={() => setActiveTab('weblinks')}>
                    <QrCode size={18} />
                    <span>Manage QR Portals ({weblinks.length})</span>
                  </button>
                  <button className="adm-btn-action" onClick={() => setActiveTab('visitors')}>
                    <Users size={18} />
                    <span>Visitor Directory ({visitors.length})</span>
                  </button>
                  <button className="adm-btn-action" onClick={() => setActiveTab('developer')}>
                    <Sliders size={18} />
                    <span>Configure Developer Toggles (1-Tap Admin)</span>
                  </button>
                  <button className="adm-btn-action" onClick={() => setActiveTab('chat-history')}>
                    <MessageSquare size={18} color="#00ffff" />
                    <span>View AI Chat Transcripts</span>
                  </button>
                  <button className="adm-btn-action" onClick={() => setActiveTab('branding')}>
                    <LayoutTemplate size={18} />
                    <span>Edit Header Title</span>
                  </button>
                  <button className="adm-btn-action" onClick={() => setActiveTab('questions')}>
                    <Plus size={18} />
                    <span>Add New Knowledge Question</span>
                  </button>
                  <button className="adm-btn-action" onClick={() => setActiveTab('backup')}>
                    <Download size={18} />
                    <span>Download Full Backup JSON</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. BRANDING TAB */}
          {activeTab === 'branding' && (
            <div className="adm-tab-panel">
              <div className="adm-card-panel">
                <h3 className="adm-panel-title">Header Organization Name</h3>
                <p className="adm-panel-desc">
                  This title is displayed on the prominent cyber-holographic banner at the top of the Home screen.
                </p>

                <form onSubmit={handleSaveHeader} className="adm-branding-form">
                  <div className="adm-form-group">
                    <label>ORGANIZATION / KIOSK TITLE</label>
                    <input
                      type="text"
                      value={headerName}
                      onChange={(e) => setHeaderName(e.target.value)}
                      placeholder="e.g. Robomiracle Technologies Private Limited"
                      required
                    />
                  </div>

                  <div className="adm-preview-box">
                    <span className="adm-preview-label">LIVE PREVIEW ON HOME SCREEN:</span>
                    <div className="adm-header-preview-capsule">
                      <h2 className="adm-preview-heading">{headerName || 'Robomiracle Technologies'}</h2>
                    </div>
                  </div>

                  <button type="submit" className="adm-submit-btn" disabled={isSavingHeader}>
                    <Save size={18} />
                    <span>{isSavingHeader ? 'Saving...' : 'Save Header Title'}</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* 3. CARDS TAB */}
          {activeTab === 'cards' && (
            <div className="adm-tab-panel">
              <div className="adm-card-panel">
                <div className="adm-panel-header-row">
                  <div>
                    <h3 className="adm-panel-title">Action Cards & Voice Control Matrix</h3>
                    <p className="adm-panel-desc">
                      Configure visibility on the kiosk home screen and enable/disable voice commands for each feature.
                    </p>
                  </div>
                  <button className="adm-reset-btn" onClick={handleResetCards}>
                    <RotateCcw size={16} />
                    <span>Reset Defaults</span>
                  </button>
                </div>

                <div className="adm-list-table">
                  {cards.map((card) => {
                    const isVoice = card.voiceAccessEnabled !== false;
                    const isVisible = card.isEnabled !== false;
                    return (
                      <div key={card.id} className={`adm-table-row ${!isVisible ? 'dimmed' : ''}`}>
                        <div className="adm-col-info">
                          <div className="adm-title-line">
                            <span className="adm-badge-id">#{card.id}</span>
                            <strong>{card.title}</strong>
                            <span className="adm-badge-route">{card.href}</span>
                          </div>
                          <p className="adm-sub-line">{card.subtitle}</p>
                          <div className="adm-kw-row">
                            <span className="adm-kw-label">Voice triggers:</span>
                            {(card.voiceKeywords || []).map((kw, i) => (
                              <span key={i} className="adm-kw-tag">"{kw}"</span>
                            ))}
                          </div>
                        </div>

                        <div className="adm-col-actions">
                          <button
                            className={`adm-toggle-pill ${isVoice ? 'on' : 'off'}`}
                            onClick={() => handleToggleCardVoice(card)}
                          >
                            {isVoice ? <Mic size={14} /> : <MicOff size={14} />}
                            <span>Voice: {isVoice ? 'ALLOWED' : 'BLOCKED'}</span>
                          </button>

                          <button
                            className={`adm-toggle-pill ${isVisible ? 'on' : 'off'}`}
                            onClick={() => handleToggleCardVisible(card)}
                          >
                            {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
                            <span>Display: {isVisible ? 'VISIBLE' : 'HIDDEN'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 4. SLIDES TAB */}
          {activeTab === 'slides' && (
            <div className="adm-tab-panel">
              <div className="adm-card-panel">
                <div className="adm-panel-header-row">
                  <div>
                    <h3 className="adm-panel-title">Banner Slideshow</h3>
                    <p className="adm-panel-desc">
                      Manage rotating high-resolution promotional banners displayed on the home screen.
                    </p>
                  </div>
                  <button className="adm-reset-btn" onClick={handleResetSlides}>
                    <RotateCcw size={16} />
                    <span>Reset Defaults</span>
                  </button>
                </div>

                {/* Add Slide Form */}
                <form onSubmit={handleAddSlide} className="adm-add-slide-form">
                  <div className="adm-slide-form-head">
                    <h4>Add New Slide Banner</h4>
                    <button
                      type="button"
                      className="adm-gallery-pick-btn"
                      onClick={() => setIsSlideGalleryOpen(true)}
                    >
                      <ImageIcon size={15} />
                      <span>Browse Image Gallery</span>
                    </button>
                  </div>
                  <div className="adm-slide-inputs-grid">
                    <input
                      type="text"
                      placeholder="Slide Title (e.g. Campus Robotics Tour)"
                      value={newSlideTitle}
                      onChange={(e) => setNewSlideTitle(e.target.value)}
                      required
                    />
                    <input
                      type="text"
                      placeholder="Subtitle or Description"
                      value={newSlideSubtitle}
                      onChange={(e) => setNewSlideSubtitle(e.target.value)}
                    />
                    <div className="adm-slide-url-picker-wrap">
                      <input
                        type="text"
                        placeholder="Image path, URL or select from gallery"
                        value={newSlideUrl}
                        onChange={(e) => setNewSlideUrl(e.target.value)}
                      />
                      <button
                        type="button"
                        className="adm-inline-gallery-btn"
                        onClick={() => setIsSlideGalleryOpen(true)}
                        title="Pick from Gallery"
                      >
                        <ImageIcon size={14} />
                        <span>Gallery</span>
                      </button>
                    </div>
                    <button type="submit" className="adm-submit-btn compact">
                      <Plus size={16} />
                      <span>Add Slide</span>
                    </button>
                  </div>
                  {newSlideUrl && (
                    <div className="adm-slide-preview-strip">
                      <img
                        src={newSlideUrl.startsWith('data:') ? newSlideUrl : assetUrl(newSlideUrl)}
                        alt="Preview"
                        className="adm-slide-preview-thumb"
                        onError={(e) => (e.target.style.display = 'none')}
                      />
                      <span className="adm-slide-preview-path">{newSlideUrl}</span>
                      <button
                        type="button"
                        className="adm-mini-clear-btn"
                        onClick={() => setNewSlideUrl('')}
                        title="Clear Image"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  )}
                </form>

                {/* Slides List */}
                <div className="adm-slides-grid">
                  {slides.map((slide) => (
                    <div key={slide.id} className={`adm-slide-card ${slide.isSelected ? 'active' : 'inactive'}`}>
                      <div className="adm-slide-thumb">
                        {slide.url ? (
                          <img src={slide.url} alt={slide.title} onError={(e) => (e.target.style.display = 'none')} />
                        ) : (
                          <div className="adm-slide-placeholder">No Image URL</div>
                        )}
                        <span className={`adm-slide-status-badge ${slide.isSelected ? 'active' : ''}`}>
                          {slide.isSelected ? 'ACTIVE' : 'DISABLED'}
                        </span>
                      </div>
                      <div className="adm-slide-content">
                        <strong>{slide.title}</strong>
                        <p>{slide.subtitle || 'No subtitle provided'}</p>
                        <div className="adm-slide-btns">
                          <button
                            className="adm-mini-btn"
                            onClick={() => handleToggleSlide(slide)}
                          >
                            {slide.isSelected ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            className="adm-mini-btn danger"
                            onClick={() => handleDeleteSlide(slide.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4.5. UNIVERSAL VOICE ASSISTANT & AUDIO CUSTOMIZATION TAB */}
          {activeTab === 'voice' && (
            <div className="adm-tab-panel">
              <div className="adm-card-panel">
                <div className="adm-panel-header-row">
                  <div>
                    <h3 className="adm-panel-title">Universal Voice Assistant & Audio Customization</h3>
                    <p className="adm-panel-desc">
                      Configure Aurra's synthesized voice characteristics, speed rate, vocal pitch, automatic boot listening, and live audition.
                    </p>
                  </div>
                  <button className="adm-btn-action" onClick={handleTestVoice} disabled={isTestingSpeech}>
                    <Volume2 size={16} />
                    <span>{isTestingSpeech ? 'Speaking Sample...' : 'Audition Voice'}</span>
                  </button>
                </div>

                <div className="adm-dev-toggles-list">
                  {/* Voice Gender */}
                  <div className="adm-dev-toggle-row">
                    <div className="adm-dev-info">
                      <strong>Synthesized Voice Gender</strong>
                      <p>Select whether Aurra speaks in a female or male voice timber profile.</p>
                    </div>
                    <div className="adm-choice-pills">
                      <button
                        type="button"
                        className={`adm-choice-pill ${kioskConfig.voiceGender === 'female' ? 'active' : ''}`}
                        onClick={() => handleUpdateKioskConfig({ voiceGender: 'female' })}
                      >
                        <span>Female Voice (Default)</span>
                        {kioskConfig.voiceGender === 'female' && <Check size={14} />}
                      </button>
                      <button
                        type="button"
                        className={`adm-choice-pill ${kioskConfig.voiceGender === 'male' ? 'active' : ''}`}
                        onClick={() => handleUpdateKioskConfig({ voiceGender: 'male' })}
                      >
                        <span>Male Voice</span>
                        {kioskConfig.voiceGender === 'male' && <Check size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Speech Rate Slider */}
                  <div className="adm-dev-toggle-row">
                    <div className="adm-dev-info">
                      <strong>Speech Articulation Speed (Rate)</strong>
                      <p>Adjust how quickly Aurra reads out answers and greetings. Standard: 1.00x (range: 0.80x to 1.30x).</p>
                    </div>
                    <div className="adm-range-control">
                      <input
                        type="range"
                        className="adm-range-slider"
                        min="0.8"
                        max="1.3"
                        step="0.05"
                        value={kioskConfig.speechRate}
                        onChange={(e) => handleUpdateKioskConfig({ speechRate: parseFloat(e.target.value) })}
                      />
                      <span className="adm-range-val">{Number(kioskConfig.speechRate || 1.0).toFixed(2)}x</span>
                    </div>
                  </div>

                  {/* Speech Pitch Slider */}
                  <div className="adm-dev-toggle-row">
                    <div className="adm-dev-info">
                      <strong>Vocal Pitch & Intonation</strong>
                      <p>Fine-tune the vocal frequency profile of speech synthesis. Standard: 1.05x (range: 0.80x to 1.30x).</p>
                    </div>
                    <div className="adm-range-control">
                      <input
                        type="range"
                        className="adm-range-slider"
                        min="0.8"
                        max="1.3"
                        step="0.05"
                        value={kioskConfig.speechPitch}
                        onChange={(e) => handleUpdateKioskConfig({ speechPitch: parseFloat(e.target.value) })}
                      />
                      <span className="adm-range-val">{Number(kioskConfig.speechPitch || 1.05).toFixed(2)}x</span>
                    </div>
                  </div>

                  {/* Auto-Listen on Boot Toggle */}
                  <div className="adm-dev-toggle-row highlight">
                    <div className="adm-dev-info">
                      <div className="adm-dev-badge">HANDS-FREE KIOSK</div>
                      <strong>Auto-Listen Microphone on Kiosk Boot</strong>
                      <p>
                        When <strong>ENABLED</strong>, the universal voice assistant bar starts listening automatically as soon as the app starts.
                        <br />
                        When <strong>DISABLED</strong>, visitors must tap the microphone button on the voice bar to speak.
                      </p>
                    </div>
                    <button
                      className={`adm-switch-btn ${kioskConfig.autoListenOnBoot ? 'active' : ''}`}
                      onClick={() => handleUpdateKioskConfig({ autoListenOnBoot: !kioskConfig.autoListenOnBoot })}
                    >
                      <div className="adm-switch-thumb" />
                      <span className="adm-switch-text">
                        {kioskConfig.autoListenOnBoot ? 'AUTO (ON)' : 'MUTED (OFF)'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Spoken Voice Tester Box */}
                <div className="adm-speech-tester-box">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Volume2 size={16} color="#00ffff" />
                    <strong style={{ fontSize: '13px', color: '#00ffff' }}>Live Spoken Voice Tester</strong>
                  </div>
                  <div className="adm-speech-tester-row">
                    <input
                      type="text"
                      className="adm-speech-tester-input"
                      value={testSpeechText}
                      onChange={(e) => setTestSpeechText(e.target.value)}
                      placeholder="Type any phrase for Aurra to speak with current settings..."
                    />
                    <button
                      type="button"
                      className="adm-submit-btn compact"
                      onClick={handleTestVoice}
                      disabled={isTestingSpeech}
                    >
                      <Volume2 size={14} />
                      <span>{isTestingSpeech ? 'Speaking...' : 'Audition'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── DEDICATED REAL AI GROK LLM SIDEBAR TAB PANEL ── */}
          {activeTab === 'ai-llm' && (
            <div className="adm-tab-panel">
              {/* 1. MASTER AI TOGGLE CARD */}
              <div className="adm-card-panel">
                <div className="adm-panel-header-row">
                  <div>
                    <h3 className="adm-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#c084fc' }}>
                      <Sparkles size={22} color="#c084fc" />
                      <span>REAL AI GROK CLOUD INFERENCE & INTELLIGENCE</span>
                    </h3>
                    <p className="adm-panel-desc">
                      Powers conversational visitor queries that don't match local navigation intents or offline FAQs. Uses Groq / Grok ultra-fast cloud inference.
                    </p>
                  </div>
                  <div className={`adm-status-pill ${llmConfig.enabled ? 'active' : 'disabled'}`} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                    {llmConfig.enabled ? '🟢 CLOUD AI ACTIVE' : '🔴 AI DISABLED'}
                  </div>
                </div>

                <div className="adm-dev-toggles-list" style={{ marginTop: '12px' }}>
                  <div className="adm-dev-toggle-row highlight">
                    <div className="adm-dev-info">
                      <div className="adm-dev-badge" style={{ background: 'rgba(192, 132, 252, 0.2)', color: '#c084fc', borderColor: '#c084fc' }}>
                        CLOUD LLM ENGINE
                      </div>
                      <strong>Enable Cloud Real AI Response System</strong>
                      <p>
                        When <strong>ENABLED</strong>, unhandled voice or text questions escalate to the cloud API endpoint in real-time.
                        <br />
                        When <strong>DISABLED</strong>, the kiosk operates 100% offline using local IndexedDB FAQs and robot hardware intents.
                      </p>
                    </div>
                    <button
                      className={`adm-switch-btn ${llmConfig.enabled ? 'active' : ''}`}
                      onClick={handleToggleLlmEnabled}
                    >
                      <div className="adm-switch-thumb" />
                      <span className="adm-switch-text">
                        {llmConfig.enabled ? 'AI ON' : 'AI OFF'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. API BASE URL & CREDENTIALS PANEL */}
              <div className="adm-card-panel">
                <h3 className="adm-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Key size={18} color="#00ffff" />
                  <span>API Base URL & Access Credentials</span>
                </h3>
                <p className="adm-panel-desc">
                  Configure the target API endpoint and API secret token. Compatible with Groq Cloud, OpenAI, or xAI Grok endpoints.
                </p>

                <div className="adm-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '14px' }}>
                  {/* API Base URL */}
                  <div className="adm-form-group">
                    <label>API BASE ENDPOINT URL</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        className="adm-form-input"
                        style={{ flex: 1, fontFamily: 'monospace' }}
                        value={llmApiUrlInput}
                        onChange={(e) => setLlmApiUrlInput(e.target.value)}
                        placeholder="https://api.groq.com/openai/v1"
                      />
                      <button
                        type="button"
                        className="adm-submit-btn"
                        onClick={() => handleSaveLlmApiUrl(llmApiUrlInput)}
                      >
                        <Save size={16} />
                        <span>Save URL</span>
                      </button>
                    </div>
                    <span className="adm-help-text" style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                      Default Groq Endpoint: <code>https://api.groq.com/openai/v1</code>
                    </span>
                  </div>

                  {/* API Key Input */}
                  <div className="adm-form-group">
                    <label>GROQ / GROK API TOKEN</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          className="adm-form-input"
                          style={{ width: '100%', fontFamily: 'monospace', paddingRight: '40px' }}
                          value={llmApiKeyInput}
                          onChange={(e) => setLlmApiKeyInput(e.target.value)}
                          placeholder="gsk_..."
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey((p) => !p)}
                          style={{
                            position: 'absolute',
                            right: '8px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'transparent',
                            border: 'none',
                            color: '#8da4be',
                            cursor: 'pointer',
                          }}
                        >
                          {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <button
                        type="button"
                        className="adm-submit-btn"
                        onClick={() => handleSaveLlmApiKey(llmApiKeyInput)}
                      >
                        <Save size={16} />
                        <span>Save Key</span>
                      </button>
                    </div>
                    <span className="adm-help-text" style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                      Key format: <code>gsk_...</code> (Ported directly from Aurra 1.0)
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. AI MODEL SELECTOR & SYSTEM PERSONA PROMPT */}
              <div className="adm-card-panel">
                <h3 className="adm-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Cpu size={18} color="#c084fc" />
                  <span>Model Selection & System Persona Prompt</span>
                </h3>

                <div className="adm-form-group" style={{ marginTop: '12px' }}>
                  <label>INFERENCE MODEL SELECTION</label>
                  <select
                    className="adm-form-select"
                    style={{ width: '100%', maxWidth: '480px' }}
                    value={llmConfig.model}
                    onChange={(e) => handleSelectLlmModel(e.target.value)}
                  >
                    <option value="llama-3.3-70b-versatile">Llama 3.3 70B Versatile (Recommended — High Accuracy & Speed)</option>
                    <option value="grok-beta">xAI Grok Beta (Grok API)</option>
                    <option value="llama-3.1-8b-instant">Llama 3.1 8B Instant (Sub-200ms Latency)</option>
                    <option value="mixtral-8x7b-32768">Mixtral 8x7B (High Context)</option>
                  </select>
                </div>

                <div className="adm-form-group" style={{ marginTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <label>AURRA SYSTEM PERSONA PROMPT (STRICT 35-WORD SPEECH RULE)</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="adm-btn-action"
                        style={{ padding: '4px 10px', fontSize: '11px', color: '#00ffff', borderColor: 'rgba(0,255,255,0.3)' }}
                        onClick={handleSyncPromptWithKnowledge}
                        title="Auto-merge the latest campus rooms, floors, and robot tours directly into this prompt"
                      >
                        <RefreshCw size={12} />
                        <span>Sync Facilities & Tours into Prompt</span>
                      </button>
                      <button
                        type="button"
                        className="adm-btn-action"
                        style={{ padding: '4px 10px', fontSize: '11px' }}
                        onClick={handleResetLlmSystemPrompt}
                      >
                        <RotateCcw size={12} />
                        <span>Reset to Default Prompt</span>
                      </button>
                    </div>
                  </div>
                  <textarea
                    className="adm-form-textarea"
                    rows={5}
                    style={{ width: '100%', marginTop: '6px', fontSize: '13px', lineHeight: '1.5' }}
                    value={llmSystemPromptInput}
                    onChange={(e) => setLlmSystemPromptInput(e.target.value)}
                  />
                  <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="adm-submit-btn"
                      onClick={() => handleSaveLlmSystemPrompt(llmSystemPromptInput)}
                    >
                      <Save size={16} />
                      <span>Save System Persona Prompt</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 4. HYPER-PARAMETERS & TUNING SLIDERS */}
              <div className="adm-card-panel">
                <h3 className="adm-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sliders size={18} color="#00ffff" />
                  <span>Inference Fine-Tuning Parameters</span>
                </h3>

                <div className="adm-sliders-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginTop: '14px' }}>
                  {/* Temperature Slider */}
                  <div className="adm-form-group">
                    <label>CREATIVITY TEMPERATURE: <strong>{llmConfig.temperature || 0.6}</strong></label>
                    <input
                      type="range"
                      min={0.0}
                      max={1.0}
                      step={0.05}
                      value={llmConfig.temperature || 0.6}
                      onChange={(e) => handleUpdateLlmParams({ temperature: parseFloat(e.target.value) })}
                      style={{ width: '100%' }}
                    />
                    <span className="adm-help-text">Lower = More precise, Higher = More creative</span>
                  </div>

                  {/* Max Tokens Slider */}
                  <div className="adm-form-group">
                    <label>MAX SPOKEN TOKENS: <strong>{llmConfig.maxTokens || 120}</strong></label>
                    <input
                      type="range"
                      min={30}
                      max={250}
                      step={10}
                      value={llmConfig.maxTokens || 120}
                      onChange={(e) => handleUpdateLlmParams({ maxTokens: parseInt(e.target.value, 10) })}
                      style={{ width: '100%' }}
                    />
                    <span className="adm-help-text">Limits output size for fast kiosk speech</span>
                  </div>

                  {/* Timeout Guard Slider */}
                  <div className="adm-form-group">
                    <label>TIMEOUT PROTECTION: <strong>{llmConfig.timeoutMs || 4500}ms</strong></label>
                    <input
                      type="range"
                      min={2000}
                      max={10000}
                      step={500}
                      value={llmConfig.timeoutMs || 4500}
                      onChange={(e) => handleUpdateLlmParams({ timeoutMs: parseInt(e.target.value, 10) })}
                      style={{ width: '100%' }}
                    />
                    <span className="adm-help-text">Aborts API if response takes longer to keep kiosk smooth</span>
                  </div>
                </div>
              </div>

              {/* 5. INTERACTIVE LIVE API PING & TESTER */}
              <div className="adm-card-panel">
                <h3 className="adm-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Terminal size={18} color="#38bdf8" />
                  <span>Live API Diagnostic & Test Query</span>
                </h3>
                <p className="adm-panel-desc">
                  Send a real live prompt to test your API key, network latency, and speech text cleaning in real-time.
                </p>

                <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                  <input
                    type="text"
                    className="adm-form-input"
                    style={{ flex: 1 }}
                    value={testAiCustomQuery}
                    onChange={(e) => setTestAiCustomQuery(e.target.value)}
                    placeholder="Enter test question..."
                  />
                  <button
                    type="button"
                    className="adm-submit-btn"
                    style={{ padding: '0 20px', whiteSpace: 'nowrap' }}
                    onClick={() => handleTestAiQuery()}
                    disabled={testAiLoading}
                  >
                    <Sparkles size={16} className={testAiLoading ? 'spin' : ''} />
                    <span>{testAiLoading ? 'Calling API...' : 'Test AI Query'}</span>
                  </button>
                </div>

                {testAiResult && (
                  <div
                    style={{
                      marginTop: '14px',
                      padding: '14px 18px',
                      borderRadius: '10px',
                      background: testAiResult.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                      border: `1px solid ${testAiResult.success ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <strong style={{ color: testAiResult.success ? '#34d399' : '#f87171' }}>
                        {testAiResult.success ? `✅ API SUCCESS (${testAiResult.latencyMs}ms)` : '❌ API CALL FAILED'}
                      </strong>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>Model: {testAiResult.model || llmConfig.model}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#f1f5f9', lineHeight: '1.4' }}>
                      {testAiResult.success ? `"${testAiResult.text}"` : (testAiResult.error || testAiResult.reason)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── DEDICATED CHAT HISTORY & TRANSCRIPTS TAB PANEL ── */}
          {activeTab === 'chat-history' && (
            <div className="adm-tab-panel">
              <AdminChatHistoryView />
            </div>
          )}

          {/* 5. QUESTIONS TAB */}
          {activeTab === 'questions' && (
            <div className="adm-tab-panel">
              <div className="adm-card-panel">
                <div className="adm-panel-header-row">
                  <div>
                    <h3 className="adm-panel-title">Q&A Knowledge Base</h3>
                    <p className="adm-panel-desc">
                      Manage offline questions and answers recognized by both `/qa` and the Universal AI Voice Assistant.
                    </p>
                  </div>
                  <div className="adm-btn-group">
                    <button className="adm-submit-btn compact" onClick={() => setShowAddQaForm(!showAddQaForm)}>
                      <Plus size={16} />
                      <span>{showAddQaForm ? 'Close Form' : 'New Question'}</span>
                    </button>
                    <button className="adm-reset-btn" onClick={handleResetQa}>
                      <RotateCcw size={16} />
                      <span>Reset</span>
                    </button>
                  </div>
                </div>

                {/* Search & Filter */}
                <div className="adm-search-row">
                  <div className="adm-search-input-wrap">
                    <Search size={18} />
                    <input
                      type="text"
                      placeholder="Search questions, keywords, or answers..."
                      value={qaSearch}
                      onChange={(e) => setQaSearch(e.target.value)}
                    />
                  </div>
                  <div className="adm-category-pills">
                    {['ALL', 'General', 'College', 'Robot', 'Facilities', 'Admissions'].map((cat) => (
                      <button
                        key={cat}
                        className={`adm-cat-pill ${qaCategoryFilter.toUpperCase() === cat.toUpperCase() ? 'active' : ''}`}
                        onClick={() => setQaCategoryFilter(cat)}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Add QA Form */}
                {showAddQaForm && (
                  <form onSubmit={handleAddQa} className="adm-add-qa-form">
                    <h4>Add New Knowledge Entry</h4>
                    <div className="adm-form-group">
                      <label>QUESTION PROMPT</label>
                      <input
                        type="text"
                        placeholder="e.g. Where is the main library located?"
                        value={newQuestion}
                        onChange={(e) => setNewQuestion(e.target.value)}
                        required
                      />
                    </div>
                    <div className="adm-form-group">
                      <label>AI RESPONSE ANSWER</label>
                      <textarea
                        rows={3}
                        placeholder="e.g. The Central Library is situated on the 2nd floor of the Academic Block."
                        value={newAnswer}
                        onChange={(e) => setNewAnswer(e.target.value)}
                        required
                      />
                    </div>
                    <div className="adm-form-group">
                      <label>CATEGORY</label>
                      <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
                        <option value="General">General</option>
                        <option value="College">College</option>
                        <option value="Robot">Robot</option>
                        <option value="Facilities">Facilities</option>
                        <option value="Admissions">Admissions</option>
                      </select>
                    </div>
                    <button type="submit" className="adm-submit-btn">
                      <Save size={16} />
                      <span>Save Question to Knowledge Base</span>
                    </button>
                  </form>
                )}

                {/* QA Items List */}
                <div className="adm-qa-list">
                  {filteredQuestions.map((item) => (
                    <div key={item.id} className="adm-qa-card">
                      <div className="adm-qa-header">
                        <span className="adm-qa-cat-badge">{item.category || 'General'}</span>
                        <h4 className="adm-qa-q">{item.question}</h4>
                        <button
                          className="adm-icon-btn danger"
                          onClick={() => handleDeleteQa(item.id)}
                          title="Delete entry"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <p className="adm-qa-a">{item.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 6. HARDWARE & NETWORK TAB */}
          {activeTab === 'hardware' && (
            <div className="adm-tab-panel">
              <div className="adm-card-panel">
                <h3 className="adm-panel-title">ESP32 & Raspberry Pi Connectivity</h3>
                <p className="adm-panel-desc">
                  Hardware controls are routed through Android's native HTTP bridge with zero CORS delays.
                </p>

                <div className="adm-hardware-status-row">
                  <div className="adm-hw-badge-card">
                    <span className="adm-hw-title">ESP32 ROBOT CONTROLLER</span>
                    <span className={`adm-hw-status-dot ${espStatus.connected ? 'online' : 'offline'}`} />
                    <strong>{espStatus.connected ? 'ONLINE' : 'DISCONNECTED'}</strong>
                    <span className="adm-hw-ip">Endpoint: {espStatus.ip || 'http://192.168.4.1'}</span>
                  </div>

                  <div className="adm-hw-badge-card">
                    <span className="adm-hw-title">RASPBERRY PI EXPRESSION ENGINE</span>
                    <span className={`adm-hw-status-dot ${rpiStatus.connected ? 'online' : 'offline'}`} />
                    <strong>{rpiStatus.connected ? 'ONLINE' : 'STANDBY'}</strong>
                    <span className="adm-hw-ip">Port: 8080</span>
                  </div>
                </div>

                {/* Wi-Fi Pair Form */}
                <form onSubmit={handleConnectWifi} className="adm-wifi-pair-form">
                  <h4>Pair ESP32 to External 2.4 GHz Wi-Fi</h4>
                  <div className="adm-wifi-grid">
                    <input
                      type="text"
                      placeholder="Wi-Fi SSID (2.4 GHz)"
                      value={wifiSsid}
                      onChange={(e) => setWifiSsid(e.target.value)}
                      required
                    />
                    <input
                      type="password"
                      placeholder="Wi-Fi Password"
                      value={wifiPassword}
                      onChange={(e) => setWifiPassword(e.target.value)}
                    />
                    <button type="submit" className="adm-submit-btn compact" disabled={isConnectingWifi}>
                      <Wifi size={16} />
                      <span>{isConnectingWifi ? 'Pairing...' : 'Dispatch Wi-Fi'}</span>
                    </button>
                  </div>
                </form>

                {/* Robot Hardware Parameters & Control Defaults Card */}
                <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(0, 213, 255, 0.2)' }}>
                  <div className="adm-panel-header-row" style={{ marginBottom: '14px' }}>
                    <div>
                      <h4 className="adm-panel-title" style={{ fontSize: '16px' }}>Robot Hardware Parameters & Control Defaults</h4>
                      <p className="adm-panel-desc">
                        Configure connection endpoints, default motor drive velocities, collision radar threshold, eye illumination color, and servo resting angles.
                      </p>
                    </div>
                    <button className="adm-btn-action" onClick={handleTestHardwarePose}>
                      <Compass size={16} />
                      <span>Test Resting Pose</span>
                    </button>
                  </div>

                  <div className="adm-dev-toggles-list">
                    {/* ESP32 IP Config */}
                    <div className="adm-dev-toggle-row">
                      <div className="adm-dev-info" style={{ flex: 1 }}>
                        <strong>ESP32 Microcontroller IP / Host</strong>
                        <p>Default: <code>192.168.4.1</code> (SoftAP) or dynamic IP assigned by external Wi-Fi router.</p>
                        <input
                          type="text"
                          className="adm-form-input highlight"
                          style={{ marginTop: '8px', maxWidth: '320px', fontFamily: 'monospace' }}
                          value={kioskConfig.esp32Ip}
                          onChange={(e) => handleUpdateKioskConfig({ esp32Ip: e.target.value.trim() })}
                          placeholder="192.168.4.1"
                        />
                      </div>
                    </div>

                    {/* Raspberry Pi IP Config */}
                    <div className="adm-dev-toggle-row">
                      <div className="adm-dev-info" style={{ flex: 1 }}>
                        <strong>Raspberry Pi Expression Engine Host & Port</strong>
                        <p>Default: <code>192.168.4.2:8080</code> for facial expressions & animatronics WebSocket.</p>
                        <input
                          type="text"
                          className="adm-form-input"
                          style={{ marginTop: '8px', maxWidth: '320px', fontFamily: 'monospace' }}
                          value={kioskConfig.raspberryPiIp}
                          onChange={(e) => handleUpdateKioskConfig({ raspberryPiIp: e.target.value.trim() })}
                          placeholder="192.168.4.2:8080"
                        />
                      </div>
                    </div>

                    {/* Default Motor Speed Slider */}
                    <div className="adm-dev-toggle-row">
                      <div className="adm-dev-info">
                        <strong>Default Motor Cruise Speed (PWM Velocity)</strong>
                        <p>Controls how fast Aurra drives across the room when executing directional navigation. Standard: 180 (range: 100 to 255).</p>
                      </div>
                      <div className="adm-range-control">
                        <input
                          type="range"
                          className="adm-range-slider"
                          min="100"
                          max="255"
                          step="5"
                          value={kioskConfig.defaultMotorSpeed}
                          onChange={(e) => handleUpdateKioskConfig({ defaultMotorSpeed: parseInt(e.target.value, 10) })}
                        />
                        <span className="adm-range-val">{kioskConfig.defaultMotorSpeed} / 255</span>
                      </div>
                    </div>

                    {/* Radar Obstacle Threshold Slider */}
                    <div className="adm-dev-toggle-row">
                      <div className="adm-dev-info">
                        <strong>Collision Radar Obstacle Threshold (cm)</strong>
                        <p>Automatic emergency brake distance trigger when approaching walls or people. Standard: 25 cm.</p>
                      </div>
                      <div className="adm-range-control">
                        <input
                          type="range"
                          className="adm-range-slider"
                          min="10"
                          max="100"
                          step="5"
                          value={kioskConfig.radarObstacleThresholdCm}
                          onChange={(e) => handleUpdateKioskConfig({ radarObstacleThresholdCm: parseInt(e.target.value, 10) })}
                        />
                        <span className="adm-range-val">{kioskConfig.radarObstacleThresholdCm} cm</span>
                      </div>
                    </div>

                    {/* Robot Eyes Illumination Color */}
                    <div className="adm-dev-toggle-row">
                      <div className="adm-dev-info">
                        <strong>Robot Eye Illumination Color</strong>
                        <p>Ambient facial LED ring and screen iris color theme.</p>
                        <div className="adm-color-picker-group" style={{ marginTop: '8px' }}>
                          {[
                            { hex: '#00FFFF', name: 'Cyber Cyan' },
                            { hex: '#00FF88', name: 'Matrix Emerald' },
                            { hex: '#FF0055', name: 'Neon Rose' },
                            { hex: '#BD00FF', name: 'Electric Violet' },
                            { hex: '#FFD700', name: 'Solar Gold' },
                            { hex: '#FFFFFF', name: 'Pure White' },
                          ].map((c) => (
                            <button
                              key={c.hex}
                              type="button"
                              className={`adm-color-circle ${kioskConfig.defaultEyeColorHex === c.hex ? 'selected' : ''}`}
                              style={{ backgroundColor: c.hex, color: c.hex === '#FFFFFF' || c.hex === '#FFD700' ? '#000000' : '#ffffff' }}
                              onClick={() => handleSendEyeColor(c.hex)}
                              title={c.name}
                            />
                          ))}
                          <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#00ffff', marginLeft: '6px' }}>
                            {kioskConfig.defaultEyeColorHex}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Head Pan Angle Slider */}
                    <div className="adm-dev-toggle-row">
                      <div className="adm-dev-info">
                        <strong>Head Pan Servo Resting Angle (Left / Right)</strong>
                        <p>Center neutral alignment position for servo axis 1. Default: 90° (range: 30° to 150°).</p>
                      </div>
                      <div className="adm-range-control">
                        <input
                          type="range"
                          className="adm-range-slider"
                          min="30"
                          max="150"
                          step="1"
                          value={kioskConfig.defaultHeadPanAngle}
                          onChange={(e) => handleUpdateKioskConfig({ defaultHeadPanAngle: parseInt(e.target.value, 10) })}
                        />
                        <span className="adm-range-val">{kioskConfig.defaultHeadPanAngle}°</span>
                      </div>
                    </div>

                    {/* Head Tilt Angle Slider */}
                    <div className="adm-dev-toggle-row">
                      <div className="adm-dev-info">
                        <strong>Head Tilt Servo Resting Angle (Up / Down)</strong>
                        <p>Center neutral pitch angle for servo axis 2. Default: 90° (range: 30° to 150°).</p>
                      </div>
                      <div className="adm-range-control">
                        <input
                          type="range"
                          className="adm-range-slider"
                          min="30"
                          max="150"
                          step="1"
                          value={kioskConfig.defaultHeadTiltAngle}
                          onChange={(e) => handleUpdateKioskConfig({ defaultHeadTiltAngle: parseInt(e.target.value, 10) })}
                        />
                        <span className="adm-range-val">{kioskConfig.defaultHeadTiltAngle}°</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Manual Movement Quick Test */}
                <div className="adm-hw-test-cluster" style={{ marginTop: '20px' }}>
                  <h4>Test Real-Time Hardware Actuators</h4>
                  <div className="adm-hw-test-btns">
                    <button className="adm-btn-action" onClick={() => esp32Service.sendMotorCommand('forward')}>
                      Motor: Forward
                    </button>
                    <button className="adm-btn-action" onClick={() => esp32Service.sendMotorCommand('backward')}>
                      Motor: Backward
                    </button>
                    <button className="adm-btn-action" onClick={() => esp32Service.sendMotorCommand('stop')}>
                      Motor: STOP
                    </button>
                    <button className="adm-btn-action" onClick={() => esp32Service.sendServoAngle(1, 90)}>
                      Servo: Nod Head (90°)
                    </button>
                    <button className="adm-btn-action" onClick={() => esp32Service.sendServoAngle(1, 45)}>
                      Servo: Shake Head (45°)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 7. FACES TAB */}
          {activeTab === 'faces' && (
            <div className="adm-tab-panel">
              {/* Vision AI & Greeting Settings Card */}
              <div className="adm-card-panel" style={{ marginBottom: '20px' }}>
                <div className="adm-panel-header-row">
                  <div>
                    <h3 className="adm-panel-title">Vision AI & Spoken Greeting Parameters</h3>
                    <p className="adm-panel-desc">
                      Customize spoken welcome templates for recognized VIPs, stranger greeting speech, detection frequency, and detector neural model.
                    </p>
                  </div>
                  <button className="adm-btn-action" onClick={handleTestStrangerGreeting} disabled={isTestingSpeech}>
                    <Volume2 size={16} />
                    <span>{isTestingSpeech ? 'Speaking Greeting...' : 'Audition Guest Greeting'}</span>
                  </button>
                </div>

                <div className="adm-dev-toggles-list">
                  {/* Known VIP Face Greeting Template */}
                  <div className="adm-dev-toggle-row">
                    <div className="adm-dev-info" style={{ flex: 1 }}>
                      <strong>Recognized VIP Greeting Template</strong>
                      <p>Spoken aloud whenever an enrolled face is detected by the camera. Use <code>{'{name}'}</code> for the person's name.</p>
                      <input
                        type="text"
                        className="adm-form-input highlight"
                        style={{ marginTop: '8px', width: '100%' }}
                        value={kioskConfig.faceGreetingTemplate}
                        onChange={(e) => handleUpdateKioskConfig({ faceGreetingTemplate: e.target.value })}
                        placeholder="Hello {name}! Welcome to Robomiracle Technologies."
                      />
                      <div className="adm-tokens-guide">
                        <span style={{ fontSize: '11px', color: '#8da4be' }}>Available variable:</span>
                        <span className="adm-token-pill">{'{name}'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Stranger Greeting Toggle */}
                  <div className="adm-dev-toggle-row highlight">
                    <div className="adm-dev-info">
                      <div className="adm-dev-badge">PROACTIVE ENGAGEMENT</div>
                      <strong>Stranger / Guest Greeting Speech</strong>
                      <p>
                        When <strong>ENABLED</strong>, Aurra will warmly greet unidentified visitors walking in front of the kiosk.
                        <br />
                        When <strong>DISABLED</strong>, Aurra only speaks when a registered face is identified.
                      </p>
                    </div>
                    <button
                      className={`adm-switch-btn ${kioskConfig.strangerGreetingEnabled ? 'active' : ''}`}
                      onClick={() => handleUpdateKioskConfig({ strangerGreetingEnabled: !kioskConfig.strangerGreetingEnabled })}
                    >
                      <div className="adm-switch-thumb" />
                      <span className="adm-switch-text">
                        {kioskConfig.strangerGreetingEnabled ? 'ACTIVE (ON)' : 'MUTED (OFF)'}
                      </span>
                    </button>
                  </div>

                  {/* Stranger Greeting Text */}
                  {kioskConfig.strangerGreetingEnabled && (
                    <div className="adm-dev-toggle-row">
                      <div className="adm-dev-info" style={{ flex: 1 }}>
                        <strong>Stranger / Guest Spoken Text</strong>
                        <p>Speech spoken to first-time visitors before they register or scan their badge.</p>
                        <input
                          type="text"
                          className="adm-form-input"
                          style={{ marginTop: '8px', width: '100%' }}
                          value={kioskConfig.strangerGreetingText}
                          onChange={(e) => handleUpdateKioskConfig({ strangerGreetingText: e.target.value })}
                          placeholder="Hello guest! Welcome to Robomiracle Technologies. Please feel free to register at the kiosk."
                        />
                      </div>
                    </div>
                  )}

                  {/* Greeting Cooldown Slider */}
                  <div className="adm-dev-toggle-row">
                    <div className="adm-dev-info">
                      <strong>Greeting Cooldown Interval (Seconds)</strong>
                      <p>Minimum time before repeating a greeting for the same face to avoid speech spamming. Recommended: 15s.</p>
                    </div>
                    <div className="adm-range-control">
                      <input
                        type="range"
                        className="adm-range-slider"
                        min="5"
                        max="60"
                        step="5"
                        value={kioskConfig.faceGreetingCooldownSec}
                        onChange={(e) => handleUpdateKioskConfig({ faceGreetingCooldownSec: parseInt(e.target.value, 10) })}
                      />
                      <span className="adm-range-val">{kioskConfig.faceGreetingCooldownSec}s</span>
                    </div>
                  </div>

                  {/* Face Detector Neural Model */}
                  <div className="adm-dev-toggle-row">
                    <div className="adm-dev-info">
                      <strong>Biometric Face Detector Model</strong>
                      <p>TinyFace is optimized for smooth 90 FPS kiosk operation. SSD MobileNet provides higher detection accuracy in varied lighting.</p>
                    </div>
                    <select
                      className="adm-form-select"
                      style={{ maxWidth: '240px' }}
                      value={kioskConfig.faceDetectorModel}
                      onChange={(e) => handleUpdateKioskConfig({ faceDetectorModel: e.target.value })}
                    >
                      <option value="tinyFace">TinyFace (Ultra-Fast 90 FPS)</option>
                      <option value="ssdMobilenetv1">SSD MobileNet V1 (High Precision)</option>
                    </select>
                  </div>

                  {/* Detection Loop Interval ms */}
                  <div className="adm-dev-toggle-row">
                    <div className="adm-dev-info">
                      <strong>Biometric Processing Interval (ms)</strong>
                      <p>Interval between inference passes. Lower is faster; higher saves tablet battery. Recommended: 250ms (4 FPS inference).</p>
                    </div>
                    <div className="adm-range-control">
                      <input
                        type="range"
                        className="adm-range-slider"
                        min="150"
                        max="500"
                        step="50"
                        value={kioskConfig.faceDetectionIntervalMs}
                        onChange={(e) => handleUpdateKioskConfig({ faceDetectionIntervalMs: parseInt(e.target.value, 10) })}
                      />
                      <span className="adm-range-val">{kioskConfig.faceDetectionIntervalMs}ms</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Enrolled Faces Management Card */}
              <div className="adm-card-panel">
                <div className="adm-panel-header-row">
                  <div>
                    <h3 className="adm-panel-title">Face Recognition & VIP Registrations ({faces.length})</h3>
                    <p className="adm-panel-desc">
                      Enrolled visitors recognized by the camera for personalized greetings.
                    </p>
                  </div>
                  <button className="adm-btn-action" onClick={() => onNavigate?.('/face-recognition')}>
                    <span>Open Camera Scanner</span>
                    <ArrowRight size={16} />
                  </button>
                </div>

                <div className="adm-faces-list">
                  {!faces || faces.length === 0 ? (
                    <div className="adm-empty-state">
                      <Smile size={36} color="#00D5FF" />
                      <p>No faces registered yet. Use the Face Scanner to enroll people.</p>
                    </div>
                  ) : (
                    faces.filter(Boolean).map((f) => (
                      <div key={f.id || f.name || Math.random()} className="adm-face-row">
                        <div className="adm-face-avatar">
                          {f.imgUrl ? (
                            <img src={f.imgUrl} alt={f.name || 'Face'} className="adm-face-thumb" />
                          ) : (
                            <Smile size={24} color="#00FFFF" />
                          )}
                        </div>
                        <div className="adm-face-details">
                          <strong>{f.name || 'Enrolled VIP'}</strong>
                          {f.info && <span className="adm-face-info">{f.info}</span>}
                          <span>Registered: {f.createdAt ? new Date(f.createdAt).toLocaleDateString() : 'N/A'}</span>
                        </div>
                        <button
                          className="adm-mini-btn danger"
                          title="Delete enrolled face"
                          onClick={async () => {
                            const targetName = f.name || 'this face';
                            if (window.confirm(`Delete registered face for "${targetName}"?`)) {
                              await offlineFaceService.deleteUser(f.id || f.name);
                              setFaces((prev) => prev.filter((item) => item.id !== f.id && item.name !== f.name));
                              showStatus(`Deleted ${targetName}`);
                            }
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 8. VISITORS DIRECTORY TAB */}
          {activeTab === 'visitors' && (
            <div className="adm-tab-panel">
              <div className="adm-card-panel">
                <div className="adm-panel-header-row">
                  <div>
                    <h3 className="adm-panel-title">Visitor Directory & Kiosk Admission Logs</h3>
                    <p className="adm-panel-desc">
                      All visitor check-ins recorded at the Aurra reception kiosk terminal.
                    </p>
                  </div>
                  <div className="adm-actions-btn-group">
                    <button className="adm-btn-action" onClick={handleExportVisitorsCSV}>
                      <FileSpreadsheet size={16} />
                      <span>Export CSV</span>
                    </button>
                    <button className="adm-btn-action" onClick={() => onNavigate?.('/form')}>
                      <UserCheck size={16} />
                      <span>Open Kiosk Check-In</span>
                    </button>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="adm-filter-toolbar">
                  <div className="adm-search-input-wrap">
                    <Search size={16} />
                    <input
                      type="text"
                      className="adm-search-input"
                      placeholder="Search by name, company, purpose, or badge..."
                      value={visitorSearch}
                      onChange={(e) => setVisitorSearch(e.target.value)}
                    />
                  </div>
                  <div className="adm-filter-chips">
                    {['ALL', 'ACTIVE', 'CHECKED_OUT'].map((f) => (
                      <button
                        key={f}
                        className={`adm-filter-chip ${visitorFilter === f ? 'active' : ''}`}
                        onClick={() => setVisitorFilter(f)}
                      >
                        {f === 'ALL' ? 'All Visitors' : f === 'ACTIVE' ? 'Active In Facility' : 'Checked Out'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Visitor Cards / Table */}
                <div className="adm-visitors-list">
                  {filteredVisitors.length === 0 ? (
                    <div className="adm-empty-state">
                      <Users size={36} color="#00D5FF" />
                      <p>No visitor check-ins matching this filter.</p>
                    </div>
                  ) : (
                    filteredVisitors.map((v) => (
                      <div key={v.id} className="adm-visitor-card">
                        <div className="adm-visitor-avatar-wrap">
                          {v.photo ? (
                            <img src={v.photo} alt={v.name} className="adm-visitor-thumb" />
                          ) : (
                            <div className="adm-visitor-placeholder">
                              <User size={22} color="#00ffff" />
                            </div>
                          )}
                          <span className={`adm-visitor-status-dot ${v.status === 'ACTIVE' ? 'active' : 'out'}`} />
                        </div>

                        <div className="adm-visitor-body">
                          <div className="adm-visitor-header">
                            <h4 className="adm-visitor-name">{v.name || 'Anonymous Visitor'}</h4>
                            <span className="adm-badge-code">{v.badgeNumber || 'AUR-VIS'}</span>
                            <span className={`adm-badge-type-pill ${(v.badgeType || 'standard').toLowerCase().replace(/\s+/g, '-')}`}>
                              {v.badgeType || 'Standard Visitor'}
                            </span>
                          </div>
                          <div className="adm-visitor-meta">
                            <span><strong>Company:</strong> {v.company || 'Independent'}</span>
                            <span><strong>Purpose:</strong> {v.purpose || 'General Inquiry'}</span>
                            <span><strong>Host:</strong> {v.host || 'Reception Desk'}</span>
                            <span><strong>In:</strong> {formatTime(v.checkInTime)}</span>
                            {v.checkOutTime && (
                              <span><strong>Out:</strong> {formatTime(v.checkOutTime)}</span>
                            )}
                          </div>
                        </div>

                        <div className="adm-visitor-actions">
                          {v.status === 'ACTIVE' && (
                            <button
                              className="adm-mini-btn success"
                              title="Mark visitor checked out"
                              onClick={() => handleCheckoutVisitor(v.id)}
                            >
                              <Check size={14} />
                              <span>Check Out</span>
                            </button>
                          )}
                          <button
                            className="adm-mini-btn danger"
                            title="Delete visitor record"
                            onClick={() => handleDeleteVisitor(v.id, v.name)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 8.5. VISITOR REGISTRATION & BADGE CUSTOMIZATION TAB */}
          {activeTab === 'registration' && (
            <div className="adm-tab-panel">
              <div className="adm-card-panel">
                <div className="adm-panel-header-row">
                  <div>
                    <h3 className="adm-panel-title">Visitor Registration & Admission Badge Customization</h3>
                    <p className="adm-panel-desc">
                      Configure badge facility branding, mandatory admission fields, unique ID prefix, and spoken welcome greeting.
                    </p>
                  </div>
                  <div className="adm-actions-btn-group">
                    <button className="adm-btn-action" onClick={handleTestWelcomeSpeech} disabled={isTestingSpeech}>
                      <Volume2 size={16} />
                      <span>{isTestingSpeech ? 'Speaking Speech...' : 'Audition Welcome Speech'}</span>
                    </button>
                    <button className="adm-btn-action" onClick={() => onNavigate?.('/form')}>
                      <UserCheck size={16} />
                      <span>Open Kiosk Check-In</span>
                    </button>
                  </div>
                </div>

                <div className="adm-dev-toggles-list">
                  {/* Organization Title for Badge Header */}
                  <div className="adm-dev-toggle-row">
                    <div className="adm-dev-info" style={{ flex: 1 }}>
                      <strong>Facility / Organization Title on Badges</strong>
                      <p>Displayed on top of the holographic digital badge and throughout the admission terminal screens.</p>
                      <input
                        type="text"
                        className="adm-form-input highlight"
                        style={{ marginTop: '8px', width: '100%' }}
                        value={kioskConfig.badgeOrgTitle}
                        onChange={(e) => handleUpdateKioskConfig({ badgeOrgTitle: e.target.value })}
                        placeholder="e.g. Robomiracle Technologies"
                      />
                    </div>
                  </div>

                  {/* Badge ID Prefix & Live Code Preview */}
                  <div className="adm-dev-toggle-row">
                    <div className="adm-dev-info" style={{ flex: 1 }}>
                      <strong>Badge ID Code Prefix</strong>
                      <p>Unique serial prefix assigned to issued visitor passes. Sample generated pass: <code>{kioskConfig.badgeIdPrefix || 'AUR-VIS-2026'}-4821</code></p>
                      <input
                        type="text"
                        className="adm-form-input"
                        style={{ marginTop: '8px', width: '100%', fontFamily: 'monospace' }}
                        value={kioskConfig.badgeIdPrefix}
                        onChange={(e) => handleUpdateKioskConfig({ badgeIdPrefix: e.target.value.trim().toUpperCase() })}
                        placeholder="e.g. AUR-VIS-2026"
                      />
                    </div>
                  </div>

                  {/* Mandatory Field 1: Photo Required */}
                  <div className="adm-dev-toggle-row highlight">
                    <div className="adm-dev-info">
                      <div className="adm-dev-badge">SECURITY POLICY</div>
                      <strong>Mandatory Biometric Portrait Photo</strong>
                      <p>
                        When <strong>ENABLED</strong>, visitors must capture their facial portrait photo via the kiosk camera before a badge can be issued.
                        <br />
                        When <strong>DISABLED</strong>, visitors may skip portrait capture and proceed directly to pass generation.
                      </p>
                    </div>
                    <button
                      className={`adm-switch-btn ${kioskConfig.requireVisitorPhoto ? 'active' : ''}`}
                      onClick={() => handleUpdateKioskConfig({ requireVisitorPhoto: !kioskConfig.requireVisitorPhoto })}
                    >
                      <div className="adm-switch-thumb" />
                      <span className="adm-switch-text">
                        {kioskConfig.requireVisitorPhoto ? 'PHOTO REQUIRED' : 'PHOTO OPTIONAL'}
                      </span>
                    </button>
                  </div>

                  {/* Mandatory Field 2: Host Required */}
                  <div className="adm-dev-toggle-row">
                    <div className="adm-dev-info">
                      <strong>Mandatory Host / Department Selection</strong>
                      <p>
                        When <strong>ENABLED</strong>, visitors must select the person or division they are meeting.
                      </p>
                    </div>
                    <button
                      className={`adm-switch-btn ${kioskConfig.requireVisitorHost ? 'active' : ''}`}
                      onClick={() => handleUpdateKioskConfig({ requireVisitorHost: !kioskConfig.requireVisitorHost })}
                    >
                      <div className="adm-switch-thumb" />
                      <span className="adm-switch-text">
                        {kioskConfig.requireVisitorHost ? 'HOST REQUIRED' : 'HOST OPTIONAL'}
                      </span>
                    </button>
                  </div>

                  {/* Mandatory Field 3: Phone Required */}
                  <div className="adm-dev-toggle-row">
                    <div className="adm-dev-info">
                      <strong>Mandatory Contact Phone Number</strong>
                      <p>
                        When <strong>ENABLED</strong>, visitor admission requires entering a mobile contact number.
                      </p>
                    </div>
                    <button
                      className={`adm-switch-btn ${kioskConfig.requireVisitorPhone ? 'active' : ''}`}
                      onClick={() => handleUpdateKioskConfig({ requireVisitorPhone: !kioskConfig.requireVisitorPhone })}
                    >
                      <div className="adm-switch-thumb" />
                      <span className="adm-switch-text">
                        {kioskConfig.requireVisitorPhone ? 'PHONE REQUIRED' : 'PHONE OPTIONAL'}
                      </span>
                    </button>
                  </div>

                  {/* Spoken Welcome Speech Template */}
                  <div className="adm-dev-toggle-row">
                    <div className="adm-dev-info" style={{ flex: 1 }}>
                      <strong>Spoken Welcome Speech Template (TTS)</strong>
                      <p>Custom welcome message broadcasted aloud by Aurra once a badge is issued.</p>
                      <textarea
                        className="adm-form-textarea"
                        rows={3}
                        style={{ marginTop: '8px', width: '100%' }}
                        value={kioskConfig.registrationWelcomeSpeech}
                        onChange={(e) => handleUpdateKioskConfig({ registrationWelcomeSpeech: e.target.value })}
                        placeholder="Welcome to {org}, {name}! Your {badgeType} has been issued. Please make yourself comfortable while I inform {host}."
                      />
                      <div className="adm-tokens-guide">
                        <span style={{ fontSize: '11px', color: '#8da4be' }}>Available variables:</span>
                        <span className="adm-token-pill">{'{name}'}</span>
                        <span className="adm-token-pill">{'{org}'}</span>
                        <span className="adm-token-pill">{'{badgeType}'}</span>
                        <span className="adm-token-pill">{'{host}'}</span>
                        <span className="adm-token-pill">{'{company}'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 9. QR CODES & WEBLINKS TAB */}
          {activeTab === 'weblinks' && (
            <div className="adm-tab-panel">
              <div className="adm-card-panel">
                <div className="adm-panel-header-row">
                  <div>
                    <h3 className="adm-panel-title">QR Code Portals & Official Links</h3>
                    <p className="adm-panel-desc">
                      Manage official links, digital brochures, social networks, and live scannable QR codes for visitor mobile devices.
                    </p>
                  </div>
                  <div className="adm-actions-btn-group">
                    <button className="adm-btn-action" onClick={handleOpenAddLink}>
                      <Plus size={16} />
                      <span>Add QR Portal</span>
                    </button>
                    <button className="adm-btn-action" onClick={() => onNavigate?.('/weblinks')}>
                      <ExternalLink size={16} />
                      <span>View on Kiosk</span>
                    </button>
                    <button className="adm-btn-action danger-outline" onClick={handleResetLinks} title="Reset to default official links">
                      <RotateCcw size={16} />
                      <span>Reset Defaults</span>
                    </button>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="adm-filter-toolbar">
                  <div className="adm-search-input-wrap">
                    <Search size={16} />
                    <input
                      type="text"
                      className="adm-search-input"
                      placeholder="Search links by title, url, tag, description..."
                      value={weblinksSearch}
                      onChange={(e) => setWeblinksSearch(e.target.value)}
                    />
                  </div>
                  <div className="adm-filter-chips">
                    {['ALL', 'web', 'brochure', 'media', 'social', 'tech', 'contact', 'custom'].map((cat) => (
                      <button
                        key={cat}
                        className={`adm-filter-chip ${weblinksCategoryFilter === cat ? 'active' : ''}`}
                        onClick={() => setWeblinksCategoryFilter(cat)}
                      >
                        {cat.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* QR Cards Grid */}
                <div className="adm-weblinks-grid">
                  {filteredWeblinks.length === 0 ? (
                    <div className="adm-empty-state">
                      <QrCode size={40} color="#00ffff" />
                      <p>No QR portals match your search or filter.</p>
                      <button className="adm-btn-action" onClick={handleOpenAddLink}>
                        <Plus size={16} />
                        <span>Add First QR Portal</span>
                      </button>
                    </div>
                  ) : (
                    filteredWeblinks.map((link) => (
                      <div
                        key={link.id}
                        className={`adm-weblink-card ${!link.isEnabled ? 'disabled' : ''}`}
                        style={{ '--link-accent': link.accentColor || '#00ffff' }}
                      >
                        <div className="adm-weblink-qr-thumb-wrap">
                          {adminQrMap[link.id] ? (
                            <img
                              src={adminQrMap[link.id]}
                              alt={`QR for ${link.title}`}
                              className="adm-weblink-qr-thumb"
                            />
                          ) : (
                            <div className="adm-weblink-qr-loading">
                              <QrCode size={32} color="#00ffff" />
                            </div>
                          )}
                          <span
                            className="adm-weblink-tag"
                            style={{
                              backgroundColor: `${link.tagColor || '#00ffff'}22`,
                              color: link.tagColor || '#00ffff',
                              borderColor: `${link.tagColor || '#00ffff'}55`,
                            }}
                          >
                            {link.tag || 'LINK'}
                          </span>
                        </div>

                        <div className="adm-weblink-info">
                          <div className="adm-weblink-title-row">
                            <h4 className="adm-weblink-title">{link.title}</h4>
                            <span className="adm-weblink-badge">{link.badge || 'Verified'}</span>
                          </div>
                          {link.subtitle && <p className="adm-weblink-subtitle">{link.subtitle}</p>}
                          <div className="adm-weblink-url-row">
                            <Link2 size={13} color="#00ffff" />
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                              className="adm-weblink-url"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {link.displayUrl || link.url}
                            </a>
                          </div>
                          {link.description && (
                            <p className="adm-weblink-desc">{link.description}</p>
                          )}
                        </div>

                        <div className="adm-weblink-actions">
                          {/* Toggle Active Switch */}
                          <div className="adm-weblink-switch-wrap" title={link.isEnabled ? 'Active on Kiosk' : 'Hidden on Kiosk'}>
                            <button
                              className={`adm-switch-btn ${link.isEnabled ? 'active' : ''}`}
                              onClick={() => handleToggleLinkActive(link)}
                            >
                              <div className="adm-switch-thumb" />
                            </button>
                            <span className="adm-switch-label">
                              {link.isEnabled ? 'Active' : 'Hidden'}
                            </span>
                          </div>

                          <div className="adm-weblink-btn-group">
                            <button
                              className="adm-mini-btn edit"
                              title="Edit link details and QR"
                              onClick={() => handleOpenEditLink(link)}
                            >
                              <Edit2 size={14} />
                              <span>Edit</span>
                            </button>
                            <button
                              className="adm-mini-btn danger"
                              title="Delete link"
                              onClick={() => handleDeleteLink(link.id, link.title)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 10. PUBLIC FACILITIES & ROOM DIRECTORY TAB */}
          {activeTab === 'facilities' && (
            <div className="adm-tab-panel">
              <div className="adm-card-panel">
                <div className="adm-panel-header-row">
                  <div>
                    <h3 className="adm-panel-title">Campus Public Facilities & Room Directory</h3>
                    <p className="adm-panel-desc">
                      Manage campus floor rooms, restrooms, cafeterias, robotics labs, boardrooms, and spoken walking directions for kiosk visitors.
                    </p>
                  </div>
                  <div className="adm-actions-btn-group">
                    <button className="adm-btn-action" onClick={handleOpenAddFacility}>
                      <Plus size={16} />
                      <span>Add Facility / Room</span>
                    </button>
                    <button className="adm-btn-action" onClick={() => onNavigate?.('/facilities')}>
                      <ExternalLink size={16} />
                      <span>View on Kiosk</span>
                    </button>
                    <button className="adm-btn-action danger-outline" onClick={handleResetFacilities} title="Reset to default campus facilities">
                      <RotateCcw size={16} />
                      <span>Reset Defaults</span>
                    </button>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="adm-filter-bar-row">
                  <div className="adm-search-input-wrap">
                    <Search size={16} />
                    <input
                      type="text"
                      placeholder="Search facility name, room code, wing, or directions..."
                      value={facilitySearch}
                      onChange={(e) => setFacilitySearch(e.target.value)}
                    />
                    {facilitySearch && (
                      <button className="adm-search-clear-btn" onClick={() => setFacilitySearch('')}>
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <div className="adm-filter-pill-group">
                    {['all', 'ground', 'first', 'second'].map((flr) => (
                      <button
                        key={flr}
                        className={`adm-filter-pill ${facilityFloorFilter === flr ? 'active' : ''}`}
                        onClick={() => setFacilityFloorFilter(flr)}
                      >
                        {flr === 'all' ? 'All Floors' :
                         flr === 'ground' ? 'Ground Floor (L0)' :
                         flr === 'first' ? 'Level 1 (R&D)' : 'Level 2 (Executive)'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Facilities List Grid */}
                <div className="adm-weblinks-grid">
                  {filteredFacilitiesAdmin.length === 0 ? (
                    <div className="adm-empty-box" style={{ gridColumn: '1 / -1' }}>
                      <Building2 size={40} color="#00ffff" />
                      <p>No facilities found matching current filters.</p>
                      <button className="adm-btn-secondary" onClick={() => { setFacilitySearch(''); setFacilityFloorFilter('all'); }}>
                        Clear Filters
                      </button>
                    </div>
                  ) : (
                    filteredFacilitiesAdmin.map((fac) => (
                      <div key={fac.id} className={`adm-weblink-card ${fac.isEnabled === false ? 'disabled' : ''}`}>
                        <div className="adm-weblink-card-header">
                          <div className="adm-weblink-icon-title">
                            <span className="adm-category-tag">{fac.code}</span>
                            <span className="adm-weblink-category">{fac.floorLabel}</span>
                          </div>
                          <div className="adm-weblink-card-controls">
                            <button
                              className={`adm-icon-btn ${fac.isEnabled !== false ? 'active' : ''}`}
                              onClick={() => handleToggleFacility(fac.id, fac.isEnabled === false)}
                              title={fac.isEnabled !== false ? 'Enabled (Click to Disable)' : 'Disabled (Click to Enable)'}
                            >
                              {fac.isEnabled !== false ? <Eye size={16} /> : <EyeOff size={16} />}
                            </button>
                          </div>
                        </div>

                        <div className="adm-weblink-body">
                          <h4 className="adm-weblink-title">{fac.name}</h4>
                          <div style={{ fontSize: '11.5px', color: '#38bdf8', marginBottom: '6px', fontWeight: 600 }}>
                            📍 {fac.wing} &bull; {fac.distanceMeters}m walk ({fac.hours})
                          </div>
                          <p className="adm-weblink-desc" style={{ WebkitLineClamp: 3 }}>
                            {fac.directions}
                          </p>
                          {fac.amenities && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                              {(Array.isArray(fac.amenities) ? fac.amenities : []).slice(0, 3).map((a, i) => (
                                <span key={i} style={{ fontSize: '10px', background: 'rgba(0,255,255,0.08)', color: '#93c5fd', padding: '2px 6px', borderRadius: '4px' }}>
                                  {a}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="adm-weblink-card-footer">
                          <button
                            className="adm-mini-btn"
                            style={{ color: '#00ffff' }}
                            onClick={() => speakWithVoice(`${fac.name}, Room ${fac.code}. Directions: ${fac.directions}`)}
                            title="Test Spoken Audio Guide"
                          >
                            <Volume2 size={14} />
                            <span>Test Voice</span>
                          </button>
                          <button
                            className="adm-mini-btn edit"
                            onClick={() => handleOpenEditFacility(fac)}
                            title="Edit Facility Details"
                          >
                            <Edit2 size={14} />
                            <span>Edit</span>
                          </button>
                          <button
                            className="adm-mini-btn danger"
                            onClick={() => handleDeleteFacility(fac.id, fac.name)}
                            title="Delete Facility"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Add / Edit Facility Modal */}
              {showFacilityModal && (
                <div className="adm-modal-overlay" onClick={() => setShowFacilityModal(false)}>
                  <div className="adm-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                    <div className="adm-modal-header">
                      <h3>{facilityModalMode === 'add' ? 'Add New Campus Facility' : 'Edit Facility & Directions'}</h3>
                      <button className="adm-modal-close-btn" onClick={() => setShowFacilityModal(false)}>
                        <X size={20} />
                      </button>
                    </div>

                    <form onSubmit={handleSaveFacility} className="adm-modal-form">
                      <div className="adm-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                        <div className="adm-form-group">
                          <label className="adm-form-label">ROOM CODE *</label>
                          <input
                            type="text"
                            className="adm-form-input"
                            value={facilityForm.code}
                            onChange={(e) => setFacilityForm({ ...facilityForm, code: e.target.value })}
                            placeholder="e.g. G-04, L1-02"
                            required
                          />
                        </div>
                        <div className="adm-form-group">
                          <label className="adm-form-label">FACILITY / ROOM NAME *</label>
                          <input
                            type="text"
                            className="adm-form-input"
                            value={facilityForm.name}
                            onChange={(e) => setFacilityForm({ ...facilityForm, name: e.target.value })}
                            placeholder="e.g. Executive Boardroom Alpha"
                            required
                          />
                        </div>
                      </div>

                      <div className="adm-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="adm-form-group">
                          <label className="adm-form-label">FLOOR LEVEL *</label>
                          <select
                            className="adm-form-input"
                            value={facilityForm.floor}
                            onChange={(e) => setFacilityForm({ ...facilityForm, floor: e.target.value })}
                          >
                            <option value="ground">Ground Floor (Level 0)</option>
                            <option value="first">First Floor (Level 1)</option>
                            <option value="second">Second Floor (Level 2)</option>
                            <option value="outdoor">Outdoor / Rooftop</option>
                          </select>
                        </div>
                        <div className="adm-form-group">
                          <label className="adm-form-label">CAMPUS WING *</label>
                          <input
                            type="text"
                            className="adm-form-input"
                            value={facilityForm.wing}
                            onChange={(e) => setFacilityForm({ ...facilityForm, wing: e.target.value })}
                            placeholder="e.g. East Wing, North Courtyard"
                            required
                          />
                        </div>
                      </div>

                      <div className="adm-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="adm-form-group">
                          <label className="adm-form-label">CATEGORY *</label>
                          <select
                            className="adm-form-input"
                            value={facilityForm.category}
                            onChange={(e) => {
                              const cat = e.target.value;
                              const label =
                                cat === 'restroom' ? 'Restroom & Hygiene' :
                                cat === 'dining' ? 'Cafeteria & Dining' :
                                cat === 'lab' ? 'Robotics & Demo' :
                                cat === 'meeting' ? 'Meeting & Boardrooms' :
                                cat === 'utility' ? 'Utility & Elevators' :
                                cat === 'medical' ? 'First Aid & Safety' :
                                cat === 'executive' ? 'Executive & Management' : 'Reception & Check-In';
                              setFacilityForm({ ...facilityForm, category: cat, categoryLabel: label });
                            }}
                          >
                            <option value="reception">Reception & Check-In</option>
                            <option value="restroom">Restroom & Hygiene</option>
                            <option value="dining">Cafeteria & Dining</option>
                            <option value="lab">Robotics & Demo Bay</option>
                            <option value="meeting">Meeting & Boardrooms</option>
                            <option value="utility">Utility & Elevators</option>
                            <option value="medical">First Aid & Health</option>
                            <option value="executive">Executive Suite</option>
                          </select>
                        </div>

                        <div className="adm-form-group">
                          <label className="adm-form-label">OPERATIONAL HOURS</label>
                          <input
                            type="text"
                            className="adm-form-input"
                            value={facilityForm.hours}
                            onChange={(e) => setFacilityForm({ ...facilityForm, hours: e.target.value })}
                            placeholder="e.g. 9:00 AM – 6:00 PM / 24/7"
                          />
                        </div>
                      </div>

                      <div className="adm-form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="adm-form-group">
                          <label className="adm-form-label">DISTANCE (METERS)</label>
                          <input
                            type="number"
                            className="adm-form-input"
                            value={facilityForm.distanceMeters}
                            onChange={(e) => setFacilityForm({ ...facilityForm, distanceMeters: e.target.value })}
                            placeholder="15"
                          />
                        </div>
                        <div className="adm-form-group">
                          <label className="adm-form-label">WALK TIME ESTIMATE</label>
                          <input
                            type="text"
                            className="adm-form-input"
                            value={facilityForm.walkTime}
                            onChange={(e) => setFacilityForm({ ...facilityForm, walkTime: e.target.value })}
                            placeholder="e.g. 30 sec walk"
                          />
                        </div>
                      </div>

                      <div className="adm-form-group">
                        <label className="adm-form-label">SPOKEN WALKING DIRECTIONS FROM KIOSK *</label>
                        <textarea
                          rows={3}
                          className="adm-form-input"
                          value={facilityForm.directions}
                          onChange={(e) => setFacilityForm({ ...facilityForm, directions: e.target.value })}
                          placeholder="e.g. Turn left from reception, walk 15 meters along the West corridor; entrance is on the left opposite the elevator."
                          required
                        />
                      </div>

                      <div className="adm-form-group">
                        <label className="adm-form-label">AMENITIES (COMMA-SEPARATED)</label>
                        <input
                          type="text"
                          className="adm-form-input"
                          value={facilityForm.amenities}
                          onChange={(e) => setFacilityForm({ ...facilityForm, amenities: e.target.value })}
                          placeholder="e.g. Wheelchair Accessible, Wi-Fi, Touchless Sensor"
                        />
                      </div>

                      <div className="adm-modal-actions">
                        <button type="button" className="adm-btn-secondary" onClick={() => setShowFacilityModal(false)}>
                          Cancel
                        </button>
                        <button type="submit" className="adm-submit-btn">
                          <Save size={16} />
                          <span>{facilityModalMode === 'add' ? 'Save Facility' : 'Update Facility'}</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 7. GUIDED ROBOT TOUR TAB */}
          {activeTab === 'tour' && (
            <div className="adm-tab-panel">
              <div className="adm-card-panel">
                {/* Header & Sub-Tab Switcher */}
                <div className="adm-panel-header">
                  <div>
                    <h3 className="adm-panel-title">Robomiracle Guided Robot Tours & Presentations</h3>
                    <p className="adm-panel-desc">
                      Customize the robot product cards (Aurra, Nexus, Nova, Dine, Gi), step-by-step presentation walkthroughs, and 3-phase voice narrations.
                    </p>
                  </div>
                  <div className="adm-tour-actions-header">
                    <button
                      className="adm-btn-secondary"
                      onClick={() => onNavigate && onNavigate('/guided-tour')}
                      title="Launch Guided Tour on Kiosk"
                    >
                      <Navigation size={16} />
                      <span>Launch on Kiosk</span>
                    </button>
                    <button
                      className="adm-btn-secondary"
                      onClick={handleResetRobotTours}
                      title="Restore factory default 5 robots and steps"
                    >
                      <RotateCcw size={16} />
                      <span>Reset Robots</span>
                    </button>
                    <button
                      className="adm-add-btn"
                      onClick={handleOpenAddRobot}
                    >
                      <Plus size={16} />
                      <span>Add Robot</span>
                    </button>
                  </div>
                </div>

                {/* Sub-Tabs: Robot Showcase vs Facility Waypoints */}
                <div className="adm-subtab-strip">
                  <button
                    className={`adm-subtab-btn ${tourSubTab === 'robots' ? 'active' : ''}`}
                    onClick={() => {
                      setTourSubTab('robots');
                      setSelectedRobotForSteps(null);
                    }}
                  >
                    <Bot size={15} />
                    <span>Robot Showcase Tours ({robotTours.length})</span>
                  </button>
                  <button
                    className={`adm-subtab-btn ${tourSubTab === 'waypoints' ? 'active' : ''}`}
                    onClick={() => setTourSubTab('waypoints')}
                  >
                    <Compass size={15} />
                    <span>Facility Waypoints & Radar ({tourStops.length})</span>
                  </button>
                </div>

                {/* ============================================================== */}
                {/* SUBTAB 1: ROBOT SHOWCASE TOURS (CLASSIC REQUESTED FORMAT)     */}
                {/* ============================================================== */}
                {tourSubTab === 'robots' && (
                  <div className="adm-robot-tour-admin-wrap">
                    {/* View A: Robots Cards List */}
                    {!selectedRobotForSteps ? (
                      <div className="adm-robots-list-arena">
                        <div className="adm-robots-grid">
                          {robotTours.map((robot, index) => (
                            <div
                              key={robot.id || robot.slug}
                              className={`adm-robot-admin-card ${!robot.isEnabled ? 'disabled' : ''}`}
                            >
                              <div className="adm-robot-card-top">
                                <div className="adm-robot-thumb-wrap">
                                  <img
                                    src={assetUrl(robot.image || '/aurra/hero.webp')}
                                    alt={robot.title}
                                    className="adm-robot-thumb"
                                    onError={(e) => { e.target.src = assetUrl('/aurra/hero.webp'); }}
                                  />
                                </div>
                                <div className="adm-robot-info-col">
                                  <div className="adm-robot-title-row">
                                    <h4 className="adm-robot-title">{robot.title}</h4>
                                    <span className="adm-robot-badge">{robot.badge || 'Robotics'}</span>
                                  </div>
                                  <span className="adm-robot-subtitle">{robot.subtitle}</span>
                                  <div className="adm-robot-meta-row">
                                    <span className="adm-robot-steps-pill">
                                      <Layers size={13} color="#00ffff" />
                                      <strong>{robot.steps?.length || 0}</strong> Tour Steps
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="adm-robot-card-actions">
                                <div className="adm-switch-wrap" title={robot.isEnabled ? 'Active on Kiosk' : 'Hidden on Kiosk'}>
                                  <button
                                    className={`adm-switch-btn ${robot.isEnabled ? 'active' : ''}`}
                                    onClick={() => handleToggleRobotEnabled(robot.id, robot.isEnabled)}
                                  >
                                    <div className="adm-switch-thumb" />
                                  </button>
                                  <span className="adm-switch-label">{robot.isEnabled ? 'Active' : 'Hidden'}</span>
                                </div>

                                <div className="adm-robot-btn-group">
                                  <button
                                    className="adm-mini-btn customize-steps"
                                    onClick={() => setSelectedRobotForSteps(robot)}
                                    title="Edit 5-step walkthrough, photos & speech narrations"
                                  >
                                    <Layers size={14} />
                                    <span>Customize Steps ({robot.steps?.length || 0})</span>
                                  </button>
                                  <button
                                    className="adm-mini-btn edit"
                                    onClick={() => handleOpenEditRobot(robot)}
                                    title="Edit robot info"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    className="adm-mini-btn danger"
                                    onClick={() => handleDeleteRobot(robot.id, robot.title)}
                                    title="Delete robot"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      /* View B: Step Customizer for Selected Robot */
                      <div className="adm-steps-manager-wrap">
                        <div className="adm-steps-manager-header">
                          <button
                            className="adm-btn-secondary"
                            onClick={() => setSelectedRobotForSteps(null)}
                          >
                            <ArrowLeft size={16} />
                            <span>Back to All Robots</span>
                          </button>
                          <div className="adm-steps-manager-titles">
                            <h4>Customizing Steps: <strong>{selectedRobotForSteps.title}</strong></h4>
                            <span className="adm-sub-desc">
                              {selectedRobotForSteps.steps?.length || 0} steps configured with 3-phase voice AI
                            </span>
                          </div>
                          <button
                            className="adm-add-btn"
                            onClick={handleOpenAddStep}
                          >
                            <Plus size={16} />
                            <span>Add Tour Step</span>
                          </button>
                        </div>

                        {(!selectedRobotForSteps.steps || selectedRobotForSteps.steps.length === 0) ? (
                          <div className="adm-empty-state">
                            <Layers size={40} color="#00ffff" />
                            <h4>No Steps Configured</h4>
                            <p>Add tour steps with photos and 3-phase speech (Intro, Main Content, Thank You).</p>
                            <button className="adm-submit-btn" onClick={handleOpenAddStep}>
                              <Plus size={16} />
                              <span>Add First Step</span>
                            </button>
                          </div>
                        ) : (
                          <div className="adm-steps-list">
                            {selectedRobotForSteps.steps.map((step, idx) => (
                              <div key={idx} className="adm-step-admin-card">
                                <div className="adm-step-order-col">
                                  <button
                                    className="adm-mini-arrow"
                                    disabled={idx === 0}
                                    onClick={() => handleMoveStep(idx, 'up')}
                                  >
                                    <ChevronUp size={16} />
                                  </button>
                                  <span className="adm-step-num-badge">#{idx + 1}</span>
                                  <button
                                    className="adm-mini-arrow"
                                    disabled={idx === selectedRobotForSteps.steps.length - 1}
                                    onClick={() => handleMoveStep(idx, 'down')}
                                  >
                                    <ChevronDown size={16} />
                                  </button>
                                </div>

                                <div className="adm-step-thumb-col">
                                  <img
                                    src={step.image?.startsWith('data:') ? step.image : assetUrl(step.image || selectedRobotForSteps.image || '/aurra/hero.webp')}
                                    alt={step.stepName}
                                    className="adm-step-thumb"
                                    onError={(e) => { e.target.src = assetUrl('/aurra/hero.webp'); }}
                                  />
                                </div>

                                <div className="adm-step-body-col">
                                  <div className="adm-step-name-row">
                                    <h4 className="adm-step-name">{step.stepName || `Step ${idx + 1}`}</h4>
                                    <span className="adm-step-img-tag">{step.image || 'default image'}</span>
                                  </div>

                                  <div className="adm-step-phases-grid">
                                    <div className="adm-phase-box">
                                      <div className="adm-phase-head">
                                        <span className="adm-phase-badge intro">1. INTRO</span>
                                        <button
                                          type="button"
                                          className={`adm-phase-test-btn ${testingStepPhase === `intro-${idx}` ? 'active' : ''}`}
                                          onClick={() => handleTestStepSpeech(step.intro, `intro-${idx}`)}
                                          title="Test Intro Speech"
                                        >
                                          <Volume2 size={12} />
                                        </button>
                                      </div>
                                      <p>{step.intro || <em>No intro text</em>}</p>
                                    </div>

                                    <div className="adm-phase-box">
                                      <div className="adm-phase-head">
                                        <span className="adm-phase-badge main">2. MAIN CONTENT</span>
                                        <button
                                          type="button"
                                          className={`adm-phase-test-btn ${testingStepPhase === `main-${idx}` ? 'active' : ''}`}
                                          onClick={() => handleTestStepSpeech(step.mainContent, `main-${idx}`)}
                                          title="Test Main Content Speech"
                                        >
                                          <Volume2 size={12} />
                                        </button>
                                      </div>
                                      <p>{step.mainContent || <em>No main content text</em>}</p>
                                    </div>

                                    <div className="adm-phase-box">
                                      <div className="adm-phase-head">
                                        <span className="adm-phase-badge thank">3. THANK YOU</span>
                                        <button
                                          type="button"
                                          className={`adm-phase-test-btn ${testingStepPhase === `thank-${idx}` ? 'active' : ''}`}
                                          onClick={() => handleTestStepSpeech(step.thankYou, `thank-${idx}`)}
                                          title="Test Thank You Speech"
                                        >
                                          <Volume2 size={12} />
                                        </button>
                                      </div>
                                      <p>{step.thankYou || <em>No thank you text</em>}</p>
                                    </div>
                                  </div>
                                </div>

                                <div className="adm-step-actions-col">
                                  <button
                                    className="adm-mini-btn edit"
                                    onClick={() => handleOpenEditStep(step, idx)}
                                    title="Edit step details & speech"
                                  >
                                    <Edit2 size={14} />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    className="adm-mini-btn danger"
                                    onClick={() => handleDeleteStep(idx)}
                                    title="Delete step"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ============================================================== */}
                {/* SUBTAB 2: FACILITY WAYPOINTS & RADAR (FLOORPLAN MODE)          */}
                {/* ============================================================== */}
                {tourSubTab === 'waypoints' && (
                  <div className="adm-tour-waypoints-wrap">
                    {/* Global Hardware & Safety Settings Card */}
                    <div className="adm-tour-global-settings">
                      <h4 className="adm-sub-title">Global Tour Dynamics & Safety Parameters</h4>
                      <div className="adm-tour-settings-grid">
                        <div className="adm-tour-setting-item">
                          <div className="adm-setting-info">
                            <label>Cruise Motor Speed (PWM)</label>
                            <span className="adm-setting-value">{kioskConfig.tourSpeed || 160} / 255</span>
                          </div>
                          <input
                            type="range"
                            min="100"
                            max="240"
                            step="5"
                            value={kioskConfig.tourSpeed || 160}
                            onChange={(e) => handleUpdateKioskConfig({ tourSpeed: Number(e.target.value) })}
                            className="adm-range-slider"
                          />
                        </div>

                        <div className="adm-tour-setting-item">
                          <div className="adm-setting-info">
                            <label>Radar Obstacle Brake Distance</label>
                            <span className="adm-setting-value">{kioskConfig.tourObstacleDistanceCm || 30} cm</span>
                          </div>
                          <input
                            type="range"
                            min="15"
                            max="60"
                            step="5"
                            value={kioskConfig.tourObstacleDistanceCm || 30}
                            onChange={(e) => handleUpdateKioskConfig({ tourObstacleDistanceCm: Number(e.target.value) })}
                            className="adm-range-slider"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Waypoints List */}
                    <div className="adm-tour-list-wrap">
                      <div className="adm-tour-list-header">
                        <div className="adm-flex-between">
                          <h4 className="adm-sub-title">Floorplan Waypoints ({tourStops.length})</h4>
                          <button className="adm-add-btn" onClick={handleOpenAddTourStop}>
                            <Plus size={15} />
                            <span>Add Waypoint</span>
                          </button>
                        </div>
                      </div>

                      <div className="adm-tour-stops-list">
                        {tourStops.map((stop, index) => (
                          <div key={stop.id} className="adm-tour-stop-card">
                            <span className="adm-tour-index-badge">#{index + 1}</span>
                            <div className="adm-tour-stop-body">
                              <h4 className="adm-tour-stop-name">{stop.name}</h4>
                              <p className="adm-sub-desc">{stop.narration}</p>
                            </div>
                            <div className="adm-tour-stop-actions">
                              <button
                                className="adm-mini-btn edit"
                                onClick={() => handleOpenEditTourStop(stop)}
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                className="adm-mini-btn danger"
                                onClick={() => handleDeleteTourStop(stop.id, stop.name)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 8. DEVELOPER OPTIONS TAB */}
          {activeTab === 'developer' && (
            <div className="adm-tab-panel">
              <div className="adm-card-panel">
                <h3 className="adm-panel-title">Developer Mode & Quick Access Settings</h3>
                <p className="adm-panel-desc">
                  Configure special shortcuts to streamline development, debugging, and live field testing.
                </p>

                <div className="adm-dev-toggles-list">
                  {/* Toggle 1: SINGLE TAP ADMIN TRIGGER (User's specific requirement!) */}
                  <div className="adm-dev-toggle-row highlight">
                    <div className="adm-dev-info">
                      <div className="adm-dev-badge">USER REQUESTED</div>
                      <strong>Single-Tap Admin Trigger (Developer Quick Access)</strong>
                      <p>
                        When <strong>ENABLED</strong>, tapping the Home screen heading just <strong>1 TIME</strong> will
                        immediately open the Admin Panel!
                        <br />
                        When <strong>DISABLED</strong>, standard <strong>4 TAPS</strong> on the heading are required.
                      </p>
                    </div>
                    <button
                      className={`adm-switch-btn ${devSettings.singleTapAdmin ? 'active' : ''}`}
                      onClick={() => handleToggleDevSetting('singleTapAdmin')}
                    >
                      <div className="adm-switch-thumb" />
                      <span className="adm-switch-text">
                        {devSettings.singleTapAdmin ? '1 TAP (ON)' : '4 TAPS (OFF)'}
                      </span>
                    </button>
                  </div>

                  {/* Toggle 2: BYPASS PIN */}
                  <div className="adm-dev-toggle-row">
                    <div className="adm-dev-info">
                      <strong>Bypass 4-Digit PIN Modal</strong>
                      <p>
                        Skip the secret code authentication modal and jump directly into the Admin Dashboard when triggered.
                      </p>
                    </div>
                    <button
                      className={`adm-switch-btn ${devSettings.bypassAdminPin ? 'active' : ''}`}
                      onClick={() => handleToggleDevSetting('bypassAdminPin')}
                    >
                      <div className="adm-switch-thumb" />
                      <span className="adm-switch-text">
                        {devSettings.bypassAdminPin ? 'BYPASS ON' : 'PIN REQUIRED'}
                      </span>
                    </button>
                  </div>

                  {/* Toggle 3: SHOW FPS OVERLAY */}
                  <div className="adm-dev-toggle-row">
                    <div className="adm-dev-info">
                      <strong>Show Live 90 FPS Telemetry Pill</strong>
                      <p>
                        Displays the real-time frame rate badge on the home screen to monitor display fluidity.
                      </p>
                    </div>
                    <button
                      className={`adm-switch-btn ${devSettings.showFpsBadge ? 'active' : ''}`}
                      onClick={() => handleToggleDevSetting('showFpsBadge')}
                    >
                      <div className="adm-switch-thumb" />
                      <span className="adm-switch-text">
                        {devSettings.showFpsBadge ? 'VISIBLE' : 'HIDDEN'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* ── Security & 4-Digit Admin PIN Management ── */}
                <div style={{ margin: '24px 0 16px 0', borderTop: '1px solid rgba(0, 213, 255, 0.2)' }} />
                <div className="adm-panel-header-row" style={{ marginBottom: '12px' }}>
                  <div>
                    <h4 className="adm-panel-title" style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Lock size={18} color="#00ffff" />
                      <span>Admin Security & Secret 4-Digit PIN Management</span>
                    </h4>
                    <p className="adm-panel-desc">
                      Customize the secret numeric PIN required to open this Admin Dashboard from the kiosk interface.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleChangeAdminPin} className="adm-speech-tester-box" style={{ background: 'rgba(0, 213, 255, 0.03)' }}>
                  <div className="adm-pin-form-grid">
                    <div className="adm-form-group">
                      <label className="adm-form-label" style={{ fontSize: '11px', color: '#8da4be' }}>CURRENT PIN (OR MASTER)</label>
                      <input
                        type="password"
                        maxLength={4}
                        className="adm-pin-input"
                        placeholder="••••"
                        value={currentPinInput}
                        onChange={(e) => setCurrentPinInput(e.target.value.replace(/\D/g, ''))}
                        required
                      />
                    </div>

                    <div className="adm-form-group">
                      <label className="adm-form-label" style={{ fontSize: '11px', color: '#8da4be' }}>NEW 4-DIGIT PIN</label>
                      <input
                        type="password"
                        maxLength={4}
                        className="adm-pin-input"
                        placeholder="••••"
                        value={newPinInput}
                        onChange={(e) => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                        required
                      />
                    </div>

                    <div className="adm-form-group">
                      <label className="adm-form-label" style={{ fontSize: '11px', color: '#8da4be' }}>CONFIRM NEW PIN</label>
                      <input
                        type="password"
                        maxLength={4}
                        className="adm-pin-input"
                        placeholder="••••"
                        value={confirmPinInput}
                        onChange={(e) => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      className="adm-submit-btn"
                      style={{ height: '46px', alignSelf: 'flex-end', whiteSpace: 'nowrap' }}
                    >
                      <Key size={16} />
                      <span>Update Secret PIN</span>
                    </button>
                  </div>

                  {pinChangeError && (
                    <div className="adm-feedback-pill error">
                      <AlertCircle size={16} />
                      <span>{pinChangeError}</span>
                    </div>
                  )}

                  {pinChangeSuccess && (
                    <div className="adm-feedback-pill success">
                      <CheckCircle2 size={16} />
                      <span>{pinChangeSuccess}</span>
                    </div>
                  )}

                  <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '6px' }}>
                    Note: Master override codes (<code>1234</code> and <code>2020</code>) are permanently active to prevent kiosk lockout.
                  </div>
                </form>

                {/* ── Kiosk Master Parameter Reset ── */}
                <div style={{ margin: '24px 0 16px 0', borderTop: '1px solid rgba(0, 213, 255, 0.2)' }} />
                <div className="adm-panel-header-row">
                  <div>
                    <h4 className="adm-panel-title" style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <RotateCcw size={18} color="#ffaa00" />
                      <span>Reset All Kiosk Parameters to Factory Defaults</span>
                    </h4>
                    <p className="adm-panel-desc">
                      Resets Voice, Face Vision, Registration, Hardware parameters, and PIN settings back to initial defaults without erasing your Dexie database cards or visitor logs.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="adm-reset-btn"
                    style={{ background: 'rgba(255, 170, 0, 0.15)', borderColor: '#ffaa00', color: '#ffaa00' }}
                    onClick={handleResetKioskDefaults}
                  >
                    <RotateCcw size={15} />
                    <span>Reset Parameters</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 9. BACKUP & SYSTEM TAB */}
          {activeTab === 'backup' && (
            <div className="adm-tab-panel">
              <div className="adm-card-panel">
                <h3 className="adm-panel-title">Database Backup, Export & Factory Reset</h3>
                <p className="adm-panel-desc">
                  Aurra runs 100% offline via Dexie IndexedDB. You can export complete snapshots to JSON or restore from file.
                </p>

                <div className="adm-backup-actions-grid">
                  <div className="adm-backup-box">
                    <Download size={32} color="#00D5FF" />
                    <h4>Export Database Backup</h4>
                    <p>Save all cards, slides, Q&As, branding, and registered faces into a JSON file.</p>
                    <button className="adm-submit-btn" onClick={handleExportBackup}>
                      <Download size={16} />
                      <span>Download JSON Backup</span>
                    </button>
                  </div>

                  <div className="adm-backup-box">
                    <Upload size={32} color="#00D5FF" />
                    <h4>Import Database Backup</h4>
                    <p>Select a previously exported JSON backup file to restore all kiosk data.</p>
                    <label className="adm-submit-btn file-input-label">
                      <Upload size={16} />
                      <span>Select JSON File</span>
                      <input type="file" accept=".json" onChange={handleImportBackup} style={{ display: 'none' }} />
                    </label>
                  </div>

                  <div className="adm-backup-box danger">
                    <RotateCcw size={32} color="#ff3366" />
                    <h4>Factory Reset System</h4>
                    <p>Reset all configuration, action cards, banner images, and Q&A to initial factory defaults.</p>
                    <button className="adm-reset-btn danger-full" onClick={handleFactoryReset}>
                      <RotateCcw size={16} />
                      <span>Factory Reset Database</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Edit / Add QR Code Link Modal ── */}
      {showLinkModal && (
        <div className="adm-modal-overlay" onClick={handleCloseLinkModal}>
          <div className="adm-modal-card adm-qr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="adm-modal-header">
              <div className="adm-modal-title-wrap">
                <QrCode size={22} color="#00ffff" />
                <h3>{modalMode === 'add' ? 'Add New QR Code Portal' : 'Edit QR Code Portal'}</h3>
              </div>
              <button className="adm-modal-close-btn" onClick={handleCloseLinkModal}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveLink} className="adm-modal-form">
              <div className="adm-qr-modal-columns">
                {/* Form Fields */}
                <div className="adm-qr-form-col">
                  <div className="adm-form-group">
                    <label className="adm-form-label">Portal Title *</label>
                    <input
                      type="text"
                      className="adm-form-input"
                      placeholder="e.g. Executive Presentation Deck"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="adm-form-group">
                    <label className="adm-form-label">Subtitle / Tagline</label>
                    <input
                      type="text"
                      className="adm-form-input"
                      placeholder="e.g. Confidential corporate overview & roadmaps"
                      value={formSubtitle}
                      onChange={(e) => setFormSubtitle(e.target.value)}
                    />
                  </div>

                  <div className="adm-form-group">
                    <label className="adm-form-label">Target URL * (Scanned by phones)</label>
                    <input
                      type="url"
                      className="adm-form-input highlight"
                      placeholder="https://example.com/portal"
                      value={formUrl}
                      onChange={(e) => setFormUrl(e.target.value)}
                      required
                    />
                  </div>

                  <div className="adm-form-row-2">
                    <div className="adm-form-group">
                      <label className="adm-form-label">Category</label>
                      <select
                        className="adm-form-select"
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                      >
                        <option value="web">Web Portal</option>
                        <option value="brochure">Digital Brochure</option>
                        <option value="media">Video & Media</option>
                        <option value="social">Social Network</option>
                        <option value="tech">Developer & SDK</option>
                        <option value="contact">Contact & Reception</option>
                        <option value="custom">Custom Portal</option>
                      </select>
                    </div>

                    <div className="adm-form-group">
                      <label className="adm-form-label">Badge Label</label>
                      <input
                        type="text"
                        className="adm-form-input"
                        placeholder="e.g. Verified Official"
                        value={formBadge}
                        onChange={(e) => setFormBadge(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="adm-form-row-2">
                    <div className="adm-form-group">
                      <label className="adm-form-label">Category Tag Text</label>
                      <input
                        type="text"
                        className="adm-form-input"
                        placeholder="e.g. PRIMARY PORTAL"
                        value={formTag}
                        onChange={(e) => setFormTag(e.target.value)}
                      />
                    </div>

                    <div className="adm-form-group">
                      <label className="adm-form-label">Color Preset</label>
                      <div className="adm-color-presets">
                        {[
                          { color: '#00ffff', name: 'Cyan' },
                          { color: '#00ff88', name: 'Emerald' },
                          { color: '#ff0055', name: 'Pink' },
                          { color: '#0a66c2', name: 'Blue' },
                          { color: '#a855f7', name: 'Purple' },
                          { color: '#ffd700', name: 'Gold' },
                        ].map((c) => (
                          <button
                            key={c.color}
                            type="button"
                            className={`adm-color-preset-btn ${formTagColor === c.color ? 'selected' : ''}`}
                            style={{ backgroundColor: c.color }}
                            onClick={() => {
                              setFormTagColor(c.color);
                              setFormAccentColor(c.color);
                            }}
                            title={c.name}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="adm-form-group">
                    <label className="adm-form-label">Detailed Description</label>
                    <textarea
                      className="adm-form-textarea"
                      rows={2}
                      placeholder="Brief overview explaining what visitors will see when scanning this QR..."
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                    />
                  </div>

                  <div className="adm-modal-checkboxes">
                    <label className="adm-checkbox-label">
                      <input
                        type="checkbox"
                        checked={formIsEnabled}
                        onChange={(e) => setFormIsEnabled(e.target.checked)}
                      />
                      <span>Active on Kiosk (Visible on /weblinks page)</span>
                    </label>

                    <label className="adm-checkbox-label">
                      <input
                        type="checkbox"
                        checked={formHasInKioskPreview}
                        onChange={(e) => setFormHasInKioskPreview(e.target.checked)}
                      />
                      <span>Enable In-Kiosk Brochure Viewer Button</span>
                    </label>
                  </div>
                </div>

                {/* Live QR Preview Column */}
                <div className="adm-qr-preview-col">
                  <div className="adm-preview-box">
                    <span className="adm-preview-badge">LIVE QR PREVIEW</span>
                    <div className="adm-preview-code-wrap">
                      {formPreviewQr ? (
                        <img src={formPreviewQr} alt="Live QR Preview" className="adm-preview-qr-img" />
                      ) : (
                        <div className="adm-preview-qr-placeholder">
                          <QrCode size={48} color="#00ffff" />
                          <span>Type a URL to generate</span>
                        </div>
                      )}
                    </div>
                    <div className="adm-preview-url-text">
                      <Link2 size={12} color="#00ffff" />
                      <span>{formUrl || 'https://...'}</span>
                    </div>
                    <div
                      className="adm-preview-card-mockup"
                      style={{ borderColor: formAccentColor, boxShadow: `0 0 16px ${formAccentColor}22` }}
                    >
                      <span
                        className="adm-mockup-tag"
                        style={{ backgroundColor: `${formTagColor}22`, color: formTagColor, borderColor: `${formTagColor}55` }}
                      >
                        {formTag || 'TAG'}
                      </span>
                      <h5>{formTitle || 'Portal Title'}</h5>
                      <p>{formSubtitle || 'Subtitle / tagline preview'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="adm-modal-actions">
                <button type="button" className="adm-btn-secondary" onClick={handleCloseLinkModal}>
                  Cancel
                </button>
                <button type="submit" className="adm-submit-btn">
                  <Save size={16} />
                  <span>{modalMode === 'add' ? 'Create QR Portal' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GUIDED TOUR ADD / EDIT MODAL */}
      {showTourModal && (
        <div className="adm-modal-backdrop" onClick={() => setShowTourModal(false)}>
          <div className="adm-modal-content wide" onClick={(e) => e.stopPropagation()}>
            <div className="adm-modal-header">
              <div className="adm-modal-title-group">
                <Compass size={22} color="#00ffff" />
                <h3>{tourModalMode === 'add' ? 'Add Facility Tour Waypoint' : 'Edit Tour Waypoint'}</h3>
              </div>
              <button className="adm-modal-close" onClick={() => setShowTourModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTourStop} className="adm-modal-form">
              <div className="adm-tour-modal-grid">
                {/* Left Column: Core Identity & Speech */}
                <div className="adm-tour-modal-col">
                  <h4 className="adm-modal-subheading">Waypoint Identity & Narration</h4>

                  <div className="adm-form-group">
                    <label>Waypoint Name *</label>
                    <input
                      type="text"
                      className="adm-form-input"
                      placeholder="e.g. Welcome Atrium & Reception"
                      value={tourFormName}
                      onChange={(e) => setTourFormName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="adm-form-group">
                    <label>Facility Zone / Department</label>
                    <input
                      type="text"
                      className="adm-form-input"
                      placeholder="e.g. Zone A - Main Lobby"
                      value={tourFormArea}
                      onChange={(e) => setTourFormArea(e.target.value)}
                    />
                  </div>

                  <div className="adm-form-group">
                    <div className="adm-label-with-action">
                      <label>Spoken Voice Narration (Aurra Speaks Here)</label>
                      <button
                        type="button"
                        className="adm-inline-test-btn"
                        onClick={handleTestModalSpeech}
                        title="Listen to this narration"
                      >
                        <Volume2 size={13} />
                        <span>{tourTestingSpeechId === 'modal' ? 'Speaking...' : 'Test Narration'}</span>
                      </button>
                    </div>
                    <textarea
                      className="adm-form-textarea"
                      rows={4}
                      placeholder="Enter the exact words Aurra should announce upon reaching this stop..."
                      value={tourFormNarration}
                      onChange={(e) => setTourFormNarration(e.target.value)}
                    />
                    <span className="adm-field-hint">
                      Spoken smoothly with the configured female/male neural voice engine.
                    </span>
                  </div>

                  <div className="adm-form-group">
                    <label>Exhibit Highlights (Comma separated)</label>
                    <input
                      type="text"
                      className="adm-form-input"
                      placeholder="e.g. Smart Reception, Facial Check-In, Digital Concierge"
                      value={tourFormHighlights}
                      onChange={(e) => setTourFormHighlights(e.target.value)}
                    />
                  </div>

                  <div className="adm-form-group">
                    <div className="adm-label-row">
                      <label>Presentation Duration</label>
                      <span className="adm-slider-val-tag">{tourFormDuration}s</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="60"
                      step="1"
                      value={tourFormDuration}
                      onChange={(e) => setTourFormDuration(Number(e.target.value))}
                      className="adm-range-slider"
                    />
                  </div>
                </div>

                {/* Right Column: Hardware Sync & Floorplan Coordinates */}
                <div className="adm-tour-modal-col">
                  <h4 className="adm-modal-subheading">Robot Hardware & Map Position</h4>

                  {/* LED Color Picker & Presets */}
                  <div className="adm-form-group">
                    <label>Eye & Aura Lighting Theme</label>
                    <div className="adm-color-picker-row">
                      <input
                        type="color"
                        value={tourFormRgb}
                        onChange={(e) => setTourFormRgb(e.target.value)}
                        className="adm-color-input"
                      />
                      <input
                        type="text"
                        value={tourFormRgb}
                        onChange={(e) => setTourFormRgb(e.target.value)}
                        className="adm-form-input color-text"
                      />
                      <div className="adm-color-preset-strip">
                        {['#00FFFF', '#38BDF8', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#EF4444'].map((col) => (
                          <button
                            key={col}
                            type="button"
                            className="adm-color-preset-dot"
                            style={{ backgroundColor: col }}
                            onClick={() => setTourFormRgb(col)}
                            title={col}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Head Servos */}
                  <div className="adm-form-group">
                    <div className="adm-label-row">
                      <label>Head Servo Tilt Angle</label>
                      <span className="adm-slider-val-tag">{tourFormTilt}°</span>
                    </div>
                    <input
                      type="range"
                      min="45"
                      max="135"
                      step="5"
                      value={tourFormTilt}
                      onChange={(e) => setTourFormTilt(Number(e.target.value))}
                      className="adm-range-slider"
                    />
                    <div className="adm-slider-extremes">
                      <span>45° (Look Down)</span>
                      <span>90° (Level)</span>
                      <span>135° (Look Up)</span>
                    </div>
                  </div>

                  <div className="adm-form-group">
                    <div className="adm-label-row">
                      <label>Head Servo Pan Angle</label>
                      <span className="adm-slider-val-tag">{tourFormPan}°</span>
                    </div>
                    <input
                      type="range"
                      min="30"
                      max="150"
                      step="5"
                      value={tourFormPan}
                      onChange={(e) => setTourFormPan(Number(e.target.value))}
                      className="adm-range-slider"
                    />
                    <div className="adm-slider-extremes">
                      <span>30° (Right)</span>
                      <span>90° (Straight)</span>
                      <span>150° (Left)</span>
                    </div>
                  </div>

                  {/* Interactive Map Coordinates */}
                  <div className="adm-form-group">
                    <label>Facility Floorplan Position</label>
                    <div className="adm-coords-sliders">
                      <div className="adm-coord-row">
                        <span>X Coordinate: <strong>{tourFormMapX}%</strong></span>
                        <input
                          type="range"
                          min="5"
                          max="95"
                          step="1"
                          value={tourFormMapX}
                          onChange={(e) => setTourFormMapX(Number(e.target.value))}
                          className="adm-range-slider"
                        />
                      </div>
                      <div className="adm-coord-row">
                        <span>Y Coordinate: <strong>{tourFormMapY}%</strong></span>
                        <input
                          type="range"
                          min="10"
                          max="90"
                          step="1"
                          value={tourFormMapY}
                          onChange={(e) => setTourFormMapY(Number(e.target.value))}
                          className="adm-range-slider"
                        />
                      </div>
                    </div>

                    {/* Floorplan Visual Mini Preview Box */}
                    <div className="adm-modal-map-preview">
                      <div className="adm-map-preview-grid" />
                      <div
                        className="adm-map-preview-pin"
                        style={{
                          left: `${tourFormMapX}%`,
                          top: `${tourFormMapY}%`,
                          borderColor: tourFormRgb,
                          boxShadow: `0 0 14px ${tourFormRgb}`,
                        }}
                      >
                        <div
                          className="adm-map-preview-dot"
                          style={{ backgroundColor: tourFormRgb }}
                        />
                        <span className="adm-map-preview-label">{tourFormName || 'Waypoint'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="adm-modal-actions">
                <button
                  type="button"
                  className="adm-btn-secondary"
                  onClick={() => setShowTourModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="adm-submit-btn">
                  <Save size={16} />
                  <span>{tourModalMode === 'add' ? 'Add Waypoint' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Robot */}
      {showRobotModal && (
        <div className="adm-modal-overlay" onClick={() => setShowRobotModal(false)}>
          <div className="adm-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="adm-modal-header">
              <div className="adm-modal-title">
                <Bot size={20} color="#00ffff" />
                <h3>{robotModalMode === 'add' ? 'Add Robot Showcase Tour' : 'Edit Robot Details'}</h3>
              </div>
              <button className="adm-modal-close" onClick={() => setShowRobotModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRobot} className="adm-modal-body">
              <div className="adm-form-grid">
                <div className="adm-form-group">
                  <label>Robot Title *</label>
                  <input
                    type="text"
                    value={robotFormTitle}
                    onChange={(e) => setRobotFormTitle(e.target.value)}
                    placeholder="e.g. Aurra Robot, Nexus Robot..."
                    required
                  />
                </div>

                <div className="adm-form-group">
                  <label>Category Badge</label>
                  <input
                    type="text"
                    value={robotFormBadge}
                    onChange={(e) => setRobotFormBadge(e.target.value)}
                    placeholder="e.g. AI Receptionist, Heavy Service, Educational..."
                  />
                </div>

                <div className="adm-form-group span-2">
                  <label>Subtitle / Role Description</label>
                  <input
                    type="text"
                    value={robotFormSubtitle}
                    onChange={(e) => setRobotFormSubtitle(e.target.value)}
                    placeholder="e.g. Autonomous Multilingual Reception Humanoid Platform"
                  />
                </div>

                <div className="adm-form-group">
                  <label>Slug / ID</label>
                  <input
                    type="text"
                    value={robotFormSlug}
                    onChange={(e) => setRobotFormSlug(e.target.value)}
                    placeholder="e.g. aurra, nexus, nova, dine, gi..."
                  />
                </div>

                <div className="adm-form-group span-2">
                  <ImageSelectorField
                    label="Hero Image (Display on Kiosk & Guided Tour)"
                    value={robotFormImage}
                    onChange={setRobotFormImage}
                    robotSlug={robotFormSlug || 'aurra'}
                    placeholder="/aurra/hero.webp"
                    fallbackDefault="/aurra/hero.webp"
                    modalTitle={`Select Hero Image for ${robotFormTitle || 'Robot'}`}
                    required
                    helperText="Select from gallery or click Quick Pick chips to change hero portrait."
                  />
                </div>
              </div>

              <div className="adm-modal-actions">
                <button
                  type="button"
                  className="adm-btn-secondary"
                  onClick={() => setShowRobotModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="adm-submit-btn">
                  <Save size={16} />
                  <span>{robotModalMode === 'add' ? 'Add Robot' : 'Save Details'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Tour Step */}
      {showStepModal && (
        <div className="adm-modal-overlay" onClick={() => setShowStepModal(false)}>
          <div className="adm-modal-card adm-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="adm-modal-header">
              <div className="adm-modal-title">
                <Layers size={20} color="#00ffff" />
                <h3>
                  {stepModalMode === 'add'
                    ? `Add Step to ${selectedRobotForSteps?.title || 'Robot'}`
                    : `Edit Step ${stepFormIndex !== null ? stepFormIndex + 1 : ''} (${stepFormName})`}
                </h3>
              </div>
              <button className="adm-modal-close" onClick={() => setShowStepModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveStep} className="adm-modal-body">
              <div className="adm-form-grid">
                <div className="adm-form-group">
                  <label>Step Name / Topic *</label>
                  <input
                    type="text"
                    value={stepFormName}
                    onChange={(e) => setStepFormName(e.target.value)}
                    placeholder="e.g. Multilingual Voice AI, Autonomous Navigation..."
                    required
                  />
                </div>

                <div className="adm-form-group span-2">
                  <ImageSelectorField
                    label="Step Showcase Image (Displayed during speech narration)"
                    value={stepFormImage}
                    onChange={setStepFormImage}
                    robotSlug={selectedRobotForSteps?.slug || 'aurra'}
                    placeholder={selectedRobotForSteps?.image || '/aurra/2.webp'}
                    fallbackDefault={selectedRobotForSteps?.image || '/aurra/hero.webp'}
                    modalTitle={`Select Showcase Image for ${stepFormName || 'Tour Step'}`}
                    helperText="Choose the image demonstrating this tour step's topic or feature."
                  />
                </div>

                {/* 3 Speech Phases */}
                <div className="adm-form-group span-2 adm-phase-editor-box">
                  <div className="adm-phase-editor-header">
                    <div className="adm-phase-title-tag intro">Phase 1: Intro Speech</div>
                    <button
                      type="button"
                      className="adm-phase-test-btn"
                      onClick={() => handleTestStepSpeech(stepFormIntro, 'intro')}
                      disabled={!stepFormIntro.trim()}
                    >
                      <Volume2 size={14} />
                      <span>{testingStepPhase === 'intro' ? 'Speaking...' : 'Test Intro Speech'}</span>
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={stepFormIntro}
                    onChange={(e) => setStepFormIntro(e.target.value)}
                    placeholder="Opening hook spoken by Aurra when arriving at this step (e.g. Welcome to Step 1! Let's explore how I communicate...)"
                  />
                </div>

                <div className="adm-form-group span-2 adm-phase-editor-box">
                  <div className="adm-phase-editor-header">
                    <div className="adm-phase-title-tag main">Phase 2: Main Content Speech</div>
                    <button
                      type="button"
                      className="adm-phase-test-btn"
                      onClick={() => handleTestStepSpeech(stepFormMainContent, 'main')}
                    >
                      <Volume2 size={14} />
                      <span>{testingStepPhase === 'main' ? 'Speaking...' : 'Test Main Speech'}</span>
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={stepFormMainContent}
                    onChange={(e) => setStepFormMainContent(e.target.value)}
                    placeholder="In-depth explanation and core technical specs spoken by Aurra..."
                  />
                </div>

                <div className="adm-form-group span-2 adm-phase-editor-box">
                  <div className="adm-phase-editor-header">
                    <div className="adm-phase-title-tag thankyou">Phase 3: Thank You / Transition</div>
                    <button
                      type="button"
                      className="adm-phase-test-btn"
                      onClick={() => handleTestStepSpeech(stepFormThankYou, 'thankyou')}
                    >
                      <Volume2 size={14} />
                      <span>{testingStepPhase === 'thankyou' ? 'Speaking...' : 'Test Transition Speech'}</span>
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={stepFormThankYou}
                    onChange={(e) => setStepFormThankYou(e.target.value)}
                    placeholder="Closing wrap-up sentence before automatically advancing to next step..."
                  />
                </div>
              </div>

              <div className="adm-modal-actions">
                <button
                  type="button"
                  className="adm-btn-secondary"
                  onClick={() => setShowStepModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="adm-submit-btn">
                  <Save size={16} />
                  <span>{stepModalMode === 'add' ? 'Add Step' : 'Save Step'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slide Banner Image Gallery Modal */}
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
