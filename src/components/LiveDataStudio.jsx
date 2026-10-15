import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Database,
  Table as TableIcon,
  RefreshCw,
  Search,
  Plus,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Check,
  X,
  AlertCircle,
  FileCode,
  Users,
  CreditCard,
  HelpCircle,
  MessageSquare,
  Building2,
  Compass,
  Bot,
  Smile,
  QrCode,
  ImageIcon,
  LayoutTemplate,
  Calendar,
  Layers,
  ArrowUpDown
} from 'lucide-react';
import { db } from '../db/dexieDb';
import './LiveDataStudio.css';

// Known tables with metadata
const TABLE_METADATA = [
  { name: 'visitors', label: 'visitors', icon: Users, desc: 'Visitor badges, check-ins & timestamps' },
  { name: 'cards', label: 'cards', icon: CreditCard, desc: 'Home screen 3D cards & voice triggers' },
  { name: 'qaQuestions', label: 'qaQuestions', icon: HelpCircle, desc: 'Offline Q&A questions, answers & keywords' },
  { name: 'chatSessions', label: 'chatSessions', icon: MessageSquare, desc: 'Conversational interaction sessions' },
  { name: 'chatMessages', label: 'chatMessages', icon: MessageSquare, desc: 'Full chat transcripts with audio/text' },
  { name: 'facilities', label: 'facilities', icon: Building2, desc: 'Campus room & floor directory' },
  { name: 'tourStops', label: 'tourStops', icon: Compass, desc: 'Guided tour waypoints & coordinates' },
  { name: 'robotTours', label: 'robotTours', icon: Bot, desc: 'Robot showroom presentations & steps' },
  { name: 'userFaces', label: 'userFaces', icon: Smile, desc: 'Biometric 128D face vectors & photos' },
  { name: 'weblinks', label: 'weblinks', icon: QrCode, desc: 'QR codes & official portal hyperlinks' },
  { name: 'images', label: 'images', icon: ImageIcon, desc: 'Ad slideshow banner carousel images' },
  { name: 'headers', label: 'headers', icon: LayoutTemplate, desc: 'Organization branding & kiosk header' },
];

export default function LiveDataStudio() {
  const [selectedTable, setSelectedTable] = useState('visitors');
  const [records, setRecords] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [tableCounts, setTableCounts] = useState({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Sorting
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('desc');

  // Modals
  const [editingRecord, setEditingRecord] = useState(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [rawJsonRecord, setRawJsonRecord] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);

  // Form state for Edit / Add Modal
  const [formData, setFormData] = useState({});
  const [formJsonMode, setFormJsonMode] = useState(false);
  const [formJsonString, setFormJsonString] = useState('');
  const [jsonError, setJsonError] = useState('');

  // Show Toast
  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Fetch counts for all tables (lightweight index counts)
  const refreshTableCounts = useCallback(async () => {
    try {
      const counts = {};
      for (const t of TABLE_METADATA) {
        if (db[t.name]) {
          counts[t.name] = await db[t.name].count();
        }
      }
      setTableCounts(counts);
    } catch (e) {
      console.warn('[LiveDataStudio] Failed to fetch table counts:', e);
    }
  }, []);

  // Fetch records for the selected table
  const fetchRecords = useCallback(async () => {
    if (!db[selectedTable]) return;
    setIsLoading(true);

    try {
      const table = db[selectedTable];
      const count = await table.count();
      setTotalCount(count);

      let allRecords = await table.toArray();

      // Apply Search Filter if any
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        allRecords = allRecords.filter((rec) => {
          return Object.values(rec).some((val) => {
            if (val === null || val === undefined) return false;
            if (typeof val === 'object') {
              try {
                return JSON.stringify(val).toLowerCase().includes(q);
              } catch {
                return false;
              }
            }
            return String(val).toLowerCase().includes(q);
          });
        });
        setTotalCount(allRecords.length);
      }

      // Apply Sort
      allRecords.sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        // If dates or numbers
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }
        const strA = String(valA);
        const strB = String(valB);
        return sortDirection === 'asc'
          ? strA.localeCompare(strB, undefined, { numeric: true })
          : strB.localeCompare(strA, undefined, { numeric: true });
      });

      // Pagination slice (lightweight DOM render)
      const startIdx = (page - 1) * pageSize;
      const paginated = allRecords.slice(startIdx, startIdx + pageSize);

      setRecords(paginated);
    } catch (err) {
      console.error('[LiveDataStudio] Error fetching table records:', err);
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedTable, page, pageSize, searchQuery, sortField, sortDirection, showToast]);

  // Initial load and table switch
  useEffect(() => {
    refreshTableCounts();
  }, [refreshTableCounts]);

  useEffect(() => {
    setPage(1);
    fetchRecords();
  }, [selectedTable, searchQuery, fetchRecords]);

  useEffect(() => {
    fetchRecords();
  }, [page, pageSize, sortField, sortDirection, fetchRecords]);

  // Auto-detect columns from records
  const columns = useMemo(() => {
    if (!records || records.length === 0) return ['id'];
    const keySet = new Set();
    records.forEach((r) => {
      Object.keys(r).forEach((k) => keySet.add(k));
    });
    const arr = Array.from(keySet);

    // Keep 'id' first, followed by name/title, followed by dates, then others
    arr.sort((a, b) => {
      if (a === 'id') return -1;
      if (b === 'id') return 1;
      if (a === 'name' || a === 'title') return -1;
      if (b === 'name' || b === 'title') return 1;
      if (a.toLowerCase().includes('time') || a.toLowerCase().includes('date')) return 1;
      if (b.toLowerCase().includes('time') || b.toLowerCase().includes('date')) return -1;
      return a.localeCompare(b);
    });
    return arr;
  }, [records]);

  // Handle Sort column click
  const handleSort = (col) => {
    if (sortField === col) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(col);
      setSortDirection('asc');
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (record) => {
    setEditingRecord(record);
    setIsAddingNew(false);
    setFormData({ ...record });
    setFormJsonString(JSON.stringify(record, null, 2));
    setFormJsonMode(false);
    setJsonError('');
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    setIsAddingNew(true);
    setEditingRecord(null);
    // Create baseline template with current columns
    const initial = {};
    columns.forEach((col) => {
      if (col !== 'id') initial[col] = '';
    });
    setFormData(initial);
    setFormJsonString(JSON.stringify(initial, null, 2));
    setFormJsonMode(false);
    setJsonError('');
  };

  // Save changes to Dexie (UPDATE / INSERT)
  const handleSaveRecord = async (e) => {
    if (e) e.preventDefault();
    setJsonError('');

    try {
      let recordToSave;

      if (formJsonMode) {
        try {
          recordToSave = JSON.parse(formJsonString);
        } catch (parseErr) {
          setJsonError(`Invalid JSON: ${parseErr.message}`);
          return;
        }
      } else {
        recordToSave = { ...formData };
      }

      const table = db[selectedTable];

      if (isAddingNew) {
        // If ID is empty string or not set, remove it so Dexie auto-increments
        if (recordToSave.id === '' || recordToSave.id === undefined) {
          delete recordToSave.id;
        } else if (!isNaN(Number(recordToSave.id))) {
          recordToSave.id = Number(recordToSave.id);
        }
        await table.add(recordToSave);
        showToast(`Record added to ${selectedTable} successfully!`);
      } else {
        // Preserving original ID data type
        const origId = editingRecord.id;
        if (typeof origId === 'number' && !isNaN(Number(recordToSave.id))) {
          recordToSave.id = Number(recordToSave.id);
        } else {
          recordToSave.id = origId;
        }
        await table.put(recordToSave);
        showToast(`Record #${recordToSave.id} updated in ${selectedTable}`);
      }

      setEditingRecord(null);
      setIsAddingNew(false);
      await fetchRecords();
      await refreshTableCounts();
    } catch (err) {
      console.error('[LiveDataStudio] Failed to save record:', err);
      setJsonError(`Database error: ${err.message}`);
    }
  };

  // Delete Record (DELETE)
  const handleConfirmDelete = async () => {
    if (!deleteCandidate) return;
    try {
      const table = db[selectedTable];
      await table.delete(deleteCandidate.id);
      showToast(`Record #${deleteCandidate.id} deleted from ${selectedTable}`);
      setDeleteCandidate(null);
      await fetchRecords();
      await refreshTableCounts();
    } catch (err) {
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  };

  // Export current table to JSON or CSV
  const handleExportTable = async (format = 'json') => {
    try {
      const allRecords = await db[selectedTable].toArray();
      if (allRecords.length === 0) {
        showToast('Table is empty', 'error');
        return;
      }

      let fileData, mimeType, filename;
      if (format === 'json') {
        fileData = JSON.stringify(allRecords, null, 2);
        mimeType = 'application/json';
        filename = `aurra_${selectedTable}_${new Date().toISOString().slice(0, 10)}.json`;
      } else {
        // CSV Export
        const allKeys = Array.from(new Set(allRecords.flatMap((r) => Object.keys(r))));
        const csvRows = [allKeys.join(',')];
        allRecords.forEach((row) => {
          const vals = allKeys.map((k) => {
            const v = row[k];
            if (v === null || v === undefined) return '""';
            const str = typeof v === 'object' ? JSON.stringify(v) : String(v);
            return `"${str.replace(/"/g, '""')}"`;
          });
          csvRows.push(vals.join(','));
        });
        fileData = csvRows.join('\n');
        mimeType = 'text/csv';
        filename = `aurra_${selectedTable}_${new Date().toISOString().slice(0, 10)}.csv`;
      }

      const blob = new Blob([fileData], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`Exported ${allRecords.length} rows as ${format.toUpperCase()}`);
    } catch (e) {
      showToast(`Export failed: ${e.message}`, 'error');
    }
  };

  // Render Cell content smartly (MySQL workbench formatting)
  const renderCellContent = (key, value) => {
    if (value === null || value === undefined) {
      return <span className="cell-null">NULL</span>;
    }
    if (typeof value === 'boolean') {
      return (
        <span className={`cell-badge ${value ? 'cell-bool-true' : 'cell-bool-false'}`}>
          {value ? 'TRUE' : 'FALSE'}
        </span>
      );
    }
    if (key === 'id') {
      return <span className="cell-pk">#{value}</span>;
    }

    // Check for Face Embeddings (128 float array)
    if (Array.isArray(value) && value.length === 128 && typeof value[0] === 'number') {
      return <span className="cell-chip chip-vector">[128-D Float Vector]</span>;
    }

    // Check for Base64 Image
    if (typeof value === 'string' && value.startsWith('data:image/')) {
      return (
        <div className="cell-img-preview" title="Base64 Image">
          <img src={value} alt="Preview" />
          <span>[Base64 Image]</span>
        </div>
      );
    }

    // Check for ISO Date string or timestamp
    if (
      typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
    ) {
      try {
        const d = new Date(value);
        return (
          <div className="cell-date" title={value}>
            <span className="cell-date-main">{d.toLocaleDateString()}</span>
            <span className="cell-date-sub">{d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>
        );
      } catch {
        return <span>{value}</span>;
      }
    }

    // Check for Arrays / Objects
    if (typeof value === 'object') {
      const isArr = Array.isArray(value);
      const label = isArr ? `[Array (${value.length})]` : `{Object (${Object.keys(value).length} keys)}`;
      return <span className="cell-chip chip-json">{label}</span>;
    }

    // Regular String / Number
    const strVal = String(value);
    if (strVal.length > 55) {
      return <span className="cell-truncate" title={strVal}>{strVal.slice(0, 50)}...</span>;
    }
    return <span>{strVal}</span>;
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="live-data-studio">
      {/* Toast Notification */}
      {toast && (
        <div className={`live-data-toast toast-${toast.type}`}>
          {toast.type === 'error' ? <AlertCircle size={16} /> : <Check size={16} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Top Banner & Title Bar */}
      <div className="lds-header">
        <div className="lds-title-wrap">
          <div className="lds-title-icon">
            <Database size={24} color="#00ffff" />
          </div>
          <div>
            <div className="lds-badge-row">
              <h2 className="lds-title">LIVE DATABASE STUDIO</h2>
              <span className="lds-db-tag">IndexedDB / Dexie v10</span>
              <span className="lds-db-name">AurraOfflineDB</span>
            </div>
            <p className="lds-desc">
              Direct MySQL Workbench-style inspector & live editor for Aurra robot storage. 0ms latency, 100% offline.
            </p>
          </div>
        </div>

        <div className="lds-actions-bar">
          <button
            type="button"
            className="lds-btn lds-btn-action"
            onClick={() => {
              fetchRecords();
              refreshTableCounts();
              showToast('Refreshed table records');
            }}
            title="Reload latest records from database"
            disabled={isLoading}
          >
            <RefreshCw size={15} className={isLoading ? 'lds-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            className="lds-btn lds-btn-add"
            onClick={handleOpenAdd}
            title="Insert a new row into this table"
          >
            <Plus size={16} />
            <span>Insert Row</span>
          </button>

          <div className="lds-export-group">
            <button
              type="button"
              className="lds-btn lds-btn-export"
              onClick={() => handleExportTable('json')}
              title="Download table data as JSON"
            >
              <Download size={14} />
              <span>JSON</span>
            </button>
            <button
              type="button"
              className="lds-btn lds-btn-export"
              onClick={() => handleExportTable('csv')}
              title="Download table data as CSV (Excel)"
            >
              <Download size={14} />
              <span>CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table Selector Tabs (Like database schema navigator) */}
      <div className="lds-tables-nav">
        <div className="lds-tables-scroll">
          {TABLE_METADATA.map((tbl) => {
            const Icon = tbl.icon;
            const count = tableCounts[tbl.name] ?? 0;
            const isSelected = selectedTable === tbl.name;
            return (
              <button
                key={tbl.name}
                type="button"
                className={`lds-table-tab ${isSelected ? 'active' : ''}`}
                onClick={() => {
                  setSelectedTable(tbl.name);
                  setSearchQuery('');
                  setSortField('id');
                  setSortDirection('desc');
                }}
              >
                <Icon size={15} />
                <span className="lds-tab-name">{tbl.label}</span>
                <span className="lds-tab-count">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Query Bar (Filter, Sort info, Records count, Paging) */}
      <div className="lds-toolbar">
        <div className="lds-search-wrap">
          <Search size={15} className="lds-search-icon" />
          <input
            type="text"
            className="lds-search-input"
            placeholder={`Filter records in "${selectedTable}"...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="lds-search-clear"
              onClick={() => setSearchQuery('')}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="lds-toolbar-right">
          <div className="lds-stat-pill">
            <span>Table:</span>
            <strong>{selectedTable}</strong>
            <span className="lds-divider">|</span>
            <span>Total:</span>
            <strong>{totalCount} rows</strong>
          </div>

          <div className="lds-page-size-wrap">
            <span>Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="lds-select-size"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          {/* Pagination Controls */}
          <div className="lds-pagination">
            <button
              type="button"
              className="lds-page-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              title="Previous Page"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="lds-page-indicator">
              Page <strong>{page}</strong> of <strong>{totalPages}</strong>
            </span>
            <button
              type="button"
              className="lds-page-btn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              title="Next Page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* MySQL Tabular Grid View */}
      <div className="lds-grid-container">
        {isLoading ? (
          <div className="lds-loading-state">
            <RefreshCw size={28} className="lds-spin" color="#00ffff" />
            <span>Querying {selectedTable}...</span>
          </div>
        ) : records.length === 0 ? (
          <div className="lds-empty-state">
            <TableIcon size={40} color="#64748b" />
            <h4>No records found in "{selectedTable}"</h4>
            <p>
              {searchQuery
                ? `No rows match the filter "${searchQuery}". Try clearing the search.`
                : 'This table is currently empty. Click "+ Insert Row" to add your first record.'}
            </p>
          </div>
        ) : (
          <div className="lds-table-scroll">
            <table className="lds-table">
              <thead>
                <tr>
                  <th className="th-num">#</th>
                  {columns.map((col) => (
                    <th
                      key={col}
                      className={`th-col ${sortField === col ? 'th-sorted' : ''}`}
                      onClick={() => handleSort(col)}
                      title={`Click to sort by ${col}`}
                    >
                      <div className="th-content">
                        <span>{col}</span>
                        <ArrowUpDown size={12} className="th-sort-icon" />
                      </div>
                    </th>
                  ))}
                  <th className="th-actions">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {records.map((row, idx) => {
                  const rowNumber = (page - 1) * pageSize + idx + 1;
                  return (
                    <tr key={row.id ?? idx} className="lds-row">
                      <td className="td-num">{rowNumber}</td>
                      {columns.map((col) => (
                        <td key={col} className={`td-cell td-${col}`}>
                          {renderCellContent(col, row[col])}
                        </td>
                      ))}
                      <td className="td-actions">
                        <div className="row-actions-group">
                          <button
                            type="button"
                            className="btn-row-action btn-edit"
                            onClick={() => handleOpenEdit(row)}
                            title="Edit this record"
                          >
                            <Edit2 size={13} />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            className="btn-row-action btn-json"
                            onClick={() => setRawJsonRecord(row)}
                            title="Inspect full JSON"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            type="button"
                            className="btn-row-action btn-delete"
                            onClick={() => setDeleteCandidate(row)}
                            title="Delete this record"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL: EDIT / INSERT ROW MODAL ── */}
      {(editingRecord || isAddingNew) && (
        <div className="lds-modal-overlay" onClick={() => { setEditingRecord(null); setIsAddingNew(false); }}>
          <div className="lds-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="lds-modal-header">
              <div className="lds-modal-title">
                {isAddingNew ? <Plus size={18} color="#00ffff" /> : <Edit2 size={18} color="#00ffff" />}
                <h3>
                  {isAddingNew ? `INSERT INTO ${selectedTable}` : `UPDATE ${selectedTable} (Row #${editingRecord.id})`}
                </h3>
              </div>
              <div className="lds-modal-modes">
                <button
                  type="button"
                  className={`btn-mode-toggle ${!formJsonMode ? 'active' : ''}`}
                  onClick={() => {
                    if (formJsonMode) {
                      try {
                        const parsed = JSON.parse(formJsonString);
                        setFormData(parsed);
                        setJsonError('');
                        setFormJsonMode(false);
                      } catch (err) {
                        setJsonError(`Fix JSON syntax before switching: ${err.message}`);
                      }
                    }
                  }}
                >
                  Fields Form
                </button>
                <button
                  type="button"
                  className={`btn-mode-toggle ${formJsonMode ? 'active' : ''}`}
                  onClick={() => {
                    setFormJsonString(JSON.stringify(formData, null, 2));
                    setJsonError('');
                    setFormJsonMode(true);
                  }}
                >
                  Raw JSON
                </button>
                <button
                  type="button"
                  className="lds-modal-close"
                  onClick={() => { setEditingRecord(null); setIsAddingNew(false); }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {jsonError && (
              <div className="lds-modal-alert">
                <AlertCircle size={15} />
                <span>{jsonError}</span>
              </div>
            )}

            <form onSubmit={handleSaveRecord} className="lds-modal-form">
              <div className="lds-modal-scroll">
                {formJsonMode ? (
                  <div className="lds-form-group">
                    <label>DOCUMENT JSON PAYLOAD</label>
                    <textarea
                      className="lds-textarea-json"
                      rows={16}
                      value={formJsonString}
                      onChange={(e) => {
                        setFormJsonString(e.target.value);
                        setJsonError('');
                      }}
                      spellCheck={false}
                    />
                  </div>
                ) : (
                  <div className="lds-form-fields-grid">
                    {/* Render fields */}
                    {Object.keys(formData).map((fieldName) => {
                      const val = formData[fieldName];
                      const isIdField = fieldName === 'id';
                      const isObj = typeof val === 'object' && val !== null;
                      const isBool = typeof val === 'boolean';

                      return (
                        <div key={fieldName} className={`lds-form-field-item ${isObj ? 'field-span-2' : ''}`}>
                          <div className="lds-field-label-row">
                            <label className="lds-field-label">
                              {fieldName} {isIdField && <span className="pk-tag">PRIMARY KEY</span>}
                            </label>
                            <span className="field-type-tag">
                              {isIdField ? 'PK' : isBool ? 'BOOLEAN' : isObj ? 'OBJECT / ARRAY' : typeof val}
                            </span>
                          </div>

                          {isBool ? (
                            <div className="lds-bool-toggle">
                              <button
                                type="button"
                                className={`bool-btn ${val === true ? 'active-true' : ''}`}
                                onClick={() => setFormData((p) => ({ ...p, [fieldName]: true }))}
                              >
                                TRUE
                              </button>
                              <button
                                type="button"
                                className={`bool-btn ${val === false ? 'active-false' : ''}`}
                                onClick={() => setFormData((p) => ({ ...p, [fieldName]: false }))}
                              >
                                FALSE
                              </button>
                            </div>
                          ) : isObj ? (
                            <textarea
                              className="lds-field-input json-input"
                              rows={3}
                              value={JSON.stringify(val, null, 2)}
                              onChange={(e) => {
                                try {
                                  const parsed = JSON.parse(e.target.value);
                                  setFormData((p) => ({ ...p, [fieldName]: parsed }));
                                } catch {
                                  // keep raw string if invalid while editing
                                }
                              }}
                            />
                          ) : isIdField && !isAddingNew ? (
                            <input
                              type="text"
                              className="lds-field-input read-only"
                              value={val ?? ''}
                              disabled
                              title="Primary Key cannot be altered"
                            />
                          ) : (
                            <input
                              type="text"
                              className="lds-field-input"
                              value={val ?? ''}
                              onChange={(e) => setFormData((p) => ({ ...p, [fieldName]: e.target.value }))}
                              placeholder={`Enter ${fieldName}...`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="lds-modal-footer">
                <button
                  type="button"
                  className="lds-btn-cancel"
                  onClick={() => { setEditingRecord(null); setIsAddingNew(false); }}
                >
                  Cancel
                </button>
                <button type="submit" className="lds-btn-save">
                  <Check size={16} />
                  <span>{isAddingNew ? 'Execute INSERT' : 'Save Changes (UPDATE)'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: RAW JSON INSPECTOR MODAL ── */}
      {rawJsonRecord && (
        <div className="lds-modal-overlay" onClick={() => setRawJsonRecord(null)}>
          <div className="lds-modal-box raw-json-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lds-modal-header">
              <div className="lds-modal-title">
                <FileCode size={18} color="#00ffff" />
                <h3>Row #{rawJsonRecord.id} Document Inspector</h3>
              </div>
              <button type="button" className="lds-modal-close" onClick={() => setRawJsonRecord(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="lds-modal-scroll">
              <pre className="lds-raw-json-viewer">
                {JSON.stringify(rawJsonRecord, null, 2)}
              </pre>
            </div>
            <div className="lds-modal-footer">
              <button
                type="button"
                className="lds-btn-save"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(rawJsonRecord, null, 2));
                  showToast('JSON copied to clipboard');
                }}
              >
                Copy JSON
              </button>
              <button type="button" className="lds-btn-cancel" onClick={() => setRawJsonRecord(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: DELETE CONFIRMATION MODAL ── */}
      {deleteCandidate && (
        <div className="lds-modal-overlay" onClick={() => setDeleteCandidate(null)}>
          <div className="lds-modal-box delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="lds-modal-header">
              <div className="lds-modal-title" style={{ color: '#ef4444' }}>
                <Trash2 size={18} color="#ef4444" />
                <h3>Confirm DELETE Statement</h3>
              </div>
              <button type="button" className="lds-modal-close" onClick={() => setDeleteCandidate(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="lds-delete-body">
              <p>
                Are you sure you want to permanently delete this record from table{' '}
                <strong style={{ color: '#00ffff' }}>`{selectedTable}`</strong>?
              </p>
              <div className="lds-delete-record-preview">
                <strong>ID:</strong> {deleteCandidate.id} |{' '}
                <strong>Primary Info:</strong> {deleteCandidate.name || deleteCandidate.title || deleteCandidate.question || 'Record'}
              </div>
              <span className="lds-delete-warning">⚠️ This action directly removes the row from IndexedDB and cannot be undone.</span>
            </div>
            <div className="lds-modal-footer">
              <button type="button" className="lds-btn-cancel" onClick={() => setDeleteCandidate(null)}>
                Cancel
              </button>
              <button type="button" className="lds-btn-delete-confirm" onClick={handleConfirmDelete}>
                <Trash2 size={15} />
                <span>Execute DELETE</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
