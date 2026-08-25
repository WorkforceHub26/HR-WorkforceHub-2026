cat << 'CSS' >> css/Management.css

/* --------------------------------------------------------------------------
   NEW: Fixed Classes for HTML Structure
   -------------------------------------------------------------------------- */

.manage-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.manage-card h3 {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-main);
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding-bottom: 0.75rem;
  border-bottom: 1px dashed var(--border-color);
}

.manage-card h3 .material-symbols-outlined {
  font-size: 22px;
  color: var(--primary-teal);
}

.card-btn-group {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.card-btn-group .action-btn {
  width: 100%;
  justify-content: flex-start;
  padding: 0.75rem 1rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  background: #ffffff;
  color: var(--text-main);
  font-weight: 600;
  font-size: 0.85rem;
  text-align: left;
}

.card-btn-group .action-btn:hover {
  background: #f8fafc;
  border-color: var(--primary-teal);
  color: var(--primary-teal);
}

.card-btn-group .action-btn .material-symbols-outlined {
  font-size: 18px;
}

/* Stat Cards */
.stat-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
}

.stat-label {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-muted);
}

.stat-val {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-main);
}

.stat-val.primary { color: var(--primary-teal); }
.stat-val.warning { color: #d97706; }
.stat-val.danger { color: #dc2626; }

/* Grid adjustments */
.management-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.25rem;
  margin-bottom: 2rem;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.25rem;
  margin-bottom: 2rem;
}
CSS
