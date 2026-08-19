"use strict";

(function () {
  const App = {
    state: {
      view: "canvas",
      theme: "system",
      nodes: new Map(),
      connections: new Map(),
      selectedNode: null,
      selectedConnection: null,
      clipboard: null,
      zoom: 1,
      panX: 0,
      panY: 0,
      workflow: null,
      runs: [],
      currentRun: null,
      logs: [],
      undoStack: [],
      redoStack: [],
      settings: {
        autosave: true,
        confirmRun: false,
        minimap: true,
        gridSnap: true,
        template: "blank",
        theme: "system",
        accent: "cyan",
        reduceMotion: false,
        compact: false,
        devtools: false,
        debug: false,
        telemetry: false,
      },
    },

    init() {
      this.cacheElements();
      this.bindEvents();
      this.initTheme();
      this.initLibrary();
      this.initSettings();
      this.initShortcuts();
      this.loadWorkflow();
      this.updateUI();
    },

    cacheElements() {
      this.el = {
        sidebar: document.getElementById("sidebar"),
        sidebarToggle: document.getElementById("sidebar-toggle"),
        themeToggle: document.getElementById("theme-toggle"),
        navItems: document.querySelectorAll(".nav-item"),
        topbarTitle: document.querySelector(".breadcrumb .crumb.active"),
        btnRun: document.getElementById("btn-run"),
        btnDeploy: document.getElementById("btn-deploy"),
        btnUndo: document.getElementById("btn-undo"),
        btnRedo: document.getElementById("btn-redo"),
        btnSave: document.getElementById("btn-save"),
        btnNew: document.getElementById("btn-new"),
        viewPanels: document.querySelectorAll(".view-panel"),
        canvasArea: document.getElementById("canvas-area"),
        canvasNodes: document.getElementById("canvas-nodes"),
        canvasConnections: document.getElementById("canvas-connections"),
        canvasGrid: document.getElementById("canvas-grid"),
        canvasMinimap: document.getElementById("canvas-minimap"),
        minimapViewport: document.getElementById("minimap-viewport"),
        emptyCanvas: document.getElementById("empty-canvas"),
        addFirstNode: document.getElementById("add-first-node"),
        zoomDisplay: document.getElementById("zoom-display"),
        zoomIn: document.getElementById("zoom-in"),
        zoomOut: document.getElementById("zoom-out"),
        zoomFit: document.getElementById("zoom-fit"),
        gridSnap: document.getElementById("grid-snap"),
        nodeCount: document.getElementById("node-count"),
        connectionCount: document.getElementById("connection-count"),
        lastSaved: document.getElementById("last-saved"),
        mousePos: document.getElementById("mouse-pos"),
        panelRight: document.getElementById("panel-right"),
        panelTabs: document.querySelectorAll(".panel-tab"),
        paneProperties: document.getElementById("pane-properties"),
        paneLogs: document.getElementById("pane-logs"),
        paneDebug: document.getElementById("pane-debug"),
        nodeForm: document.getElementById("node-form"),
        nodeId: document.getElementById("node-id"),
        nodeType: document.getElementById("node-type"),
        nodeName: document.getElementById("node-name"),
        nodeDesc: document.getElementById("node-desc"),
        nodeConfig: document.getElementById("node-config"),
        saveNode: document.getElementById("save-node"),
        deleteNode: document.getElementById("delete-node"),
        logEntries: document.getElementById("log-entries"),
        logFilter: document.getElementById("log-filter"),
        clearLogs: document.getElementById("clear-logs"),
        debugContext: document.getElementById("debug-context"),
        debugOutputs: document.getElementById("debug-outputs"),
        debugContent: document.querySelector(".debug-content"),
        runBadge: document.getElementById("run-badge"),
        libraryGrid: document.getElementById("library-grid"),
        librarySearch: document.getElementById("library-search"),
        libraryCategories: document.querySelectorAll(".category-btn"),
        runsBody: document.getElementById("runs-body"),
        runsFilterStatus: document.getElementById("runs-filter-status"),
        runsFilterWorkflow: document.getElementById("runs-filter-workflow"),
        runDetail: document.getElementById("run-detail"),
        runDetailContent: document.getElementById("run-detail-content"),
        closeRunDetail: document.getElementById("close-run-detail"),
        settingNavItems: document.querySelectorAll(".setting-nav-item"),
        modalOverlay: document.getElementById("modal-overlay"),
        modalTitle: document.getElementById("modal-title"),
        modalBody: document.getElementById("modal-body"),
        modalFooter: document.getElementById("modal-footer"),
        modalClose: document.getElementById("modal-close"),
        contextMenu: document.getElementById("context-menu"),
        toastContainer: document.getElementById("toast-container"),
        currentWorkflow: document.getElementById("current-workflow"),
      };
    },

    bindEvents() {
      // Sidebar toggle
      this.el.sidebarToggle.addEventListener("click", () => this.toggleSidebar());

      // Theme toggle
      this.el.themeToggle.addEventListener("click", () => this.cycleTheme());

      // Navigation
      this.el.navItems.forEach((item) => {
        item.addEventListener("click", () => this.switchView(item.dataset.view));
      });

      // Topbar buttons
      this.el.btnRun.addEventListener("click", () => this.runWorkflow());
      this.el.btnDeploy.addEventListener("click", () => this.deployWorkflow());
      this.el.btnUndo.addEventListener("click", () => this.undo());
      this.el.btnRedo.addEventListener("click", () => this.redo());
      this.el.btnSave.addEventListener("click", () => this.saveWorkflow());
      this.el.btnNew.addEventListener("click", () => this.newWorkflow());

      // Canvas interactions
      this.el.canvasArea.addEventListener("mousedown", (e) => this.onCanvasMouseDown(e));
      this.el.canvasArea.addEventListener("contextmenu", (e) => this.showContextMenu(e));
      this.el.addFirstNode.addEventListener("click", () => this.addNode("trigger", 200, 200));
      this.el.zoomIn.addEventListener("click", () => this.setZoom(this.state.zoom * 1.2));
      this.el.zoomOut.addEventListener("click", () => this.setZoom(this.state.zoom / 1.2));
      this.el.zoomFit.addEventListener("click", () => this.fitToView());
      this.el.canvasArea.addEventListener("mousemove", (e) => this.updateMousePos(e));

      // Panel tabs
      this.el.panelTabs.forEach((tab) => {
        tab.addEventListener("click", () => this.switchPanel(tab.dataset.panel));
      });

      // Node form
      this.el.saveNode.addEventListener("click", () => this.saveNodeProperties());
      this.el.deleteNode.addEventListener("click", () => this.deleteSelectedNode());

      // Logs
      this.el.logFilter.addEventListener("change", () => this.renderLogs());
      this.el.clearLogs.addEventListener("click", () => {
        this.state.logs = [];
        this.renderLogs();
      });

      // Library
      this.el.librarySearch.addEventListener("input", (e) => this.filterLibrary(e.target.value));
      this.el.libraryCategories.forEach((btn) => {
        btn.addEventListener("click", () => {
          this.el.libraryCategories.forEach((b) => b.classList.toggle("active", b === btn));
          this.filterLibrary();
        });
      });

      // Runs
      this.el.runsFilterStatus.addEventListener("change", () => this.renderRuns());
      this.el.runsFilterWorkflow.addEventListener("change", () => this.renderRuns());
      this.el.closeRunDetail.addEventListener("click", () => {
        this.el.runDetail.hidden = true;
      });

      // Settings navigation
      this.el.settingNavItems.forEach((item) => {
        item.addEventListener("click", () => this.switchSetting(item.dataset.setting));
      });

      // Modal
      this.el.modalClose.addEventListener("click", () => this.closeModal());
      this.el.modalOverlay.addEventListener("click", (e) => {
        if (e.target === this.el.modalOverlay) this.closeModal();
      });

      // Context menu actions
      this.el.contextMenu.querySelectorAll(".context-menu-item").forEach((item) => {
        item.addEventListener("click", () => {
          this.handleContextMenuAction(item.dataset.action);
          this.hideContextMenu();
        });
      });

      // Keyboard shortcuts
      document.addEventListener("keydown", (e) => this.handleKeydown(e));

      // External links
      this.initExternalLinks();
    },

    initTheme() {
      const saved = localStorage.getItem("maurya-theme") || "system";
      this.setTheme(saved);
      this.el.themeToggle.addEventListener("click", () => this.cycleTheme());
    },

    cycleTheme() {
      const themes = ["system", "light", "dark"];
      const current = this.state.theme;
      const next = themes[(themes.indexOf(current) + 1) % themes.length];
      this.setTheme(next);
    },

    setTheme(theme) {
      this.state.theme = theme;
      if (theme === "system") {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        document.body.setAttribute("data-theme", prefersDark ? "dark" : "light");
      } else {
        document.body.setAttribute("data-theme", theme);
      }
      localStorage.setItem("maurya-theme", theme);

      // Update radio buttons in settings
      const radio = document.querySelector(`input[name="theme"][value="${theme}"]`);
      if (radio) radio.checked = true;
    },

    toggleSidebar() {
      this.el.sidebar.classList.toggle("open");
    },

    switchView(view) {
      this.state.view = view;
      this.el.navItems.forEach((item) => {
        item.classList.toggle("active", item.dataset.view === view);
      });
      this.el.viewPanels.forEach((panel) => {
        panel.classList.toggle("active", panel.id === `view-${view}`);
      });
      this.updateBreadcrumb();
    },

    updateBreadcrumb() {
      const labels = {
        canvas: "Canvas",
        library: "Action Library",
        runs: "Execution History",
        settings: "Settings",
      };
      this.el.topbarTitle.textContent = labels[this.state.view] || "Canvas";
    },

    onCanvasMouseDown(e) {
      if (e.target === this.el.canvasArea || e.target === this.el.canvasGrid) {
        this.state.selectedNode = null;
        this.state.selectedConnection = null;
        this.updateSelection();
      }
    },

    showContextMenu(e) {
      e.preventDefault();
      this.el.contextMenu.style.left = `${e.clientX}px`;
      this.el.contextMenu.style.top = `${e.clientY}px`;
      this.el.contextMenu.classList.add("visible");
      this.el.contextMenu.hidden = false;

      const closeMenu = () => {
        this.el.contextMenu.classList.remove("visible");
        this.el.contextMenu.hidden = true;
        document.removeEventListener("click", closeMenu);
      };
      setTimeout(() => document.addEventListener("click", closeMenu), 0);
    },

    hideContextMenu() {
      this.el.contextMenu.classList.remove("visible");
      this.el.contextMenu.hidden = true;
    },

    handleContextMenuAction(action) {
      const rect = this.el.canvasArea.getBoundingClientRect();
      const x = 100 - this.state.panX / this.state.zoom;
      const y = 100 - this.state.panY / this.state.zoom;

      switch (action) {
        case "add-trigger":
          this.addNode("trigger", x, y);
          break;
        case "add-action":
          this.addNode("action", x, y);
          break;
        case "add-condition":
          this.addNode("condition", x, y);
          break;
        case "paste":
          if (this.state.clipboard) {
            this.addNode(
              this.state.clipboard.type,
              this.state.clipboard.x + 20,
              this.state.clipboard.y + 20
            );
          }
          break;
        case "select-all":
          this.state.nodes.forEach((node) => this.selectNode(node.id));
          break;
        case "delete-selected":
          this.deleteSelectedNode();
          break;
      }
    },

    addNode(type, x, y) {
      const id = `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const node = {
        id,
        type,
        name: this.getDefaultName(type),
        x: x || 200,
        y: y || 200,
        config: {},
        status: "idle",
      };
      this.state.nodes.set(id, node);
      this.renderNode(node);
      this.updateEmptyState();
      this.pushUndo();
      this.updateUI();
      this.saveWorkflowState();
      return node;
    },

    getDefaultName(type) {
      const names = {
        trigger: "New Trigger",
        action: "New Action",
        condition: "New Condition",
        transform: "New Transform",
        custom: "New Custom Node",
      };
      return names[type] || "New Node";
    },

    renderNode(node) {
      const el = document.createElement("div");
      el.className = "node";
      el.dataset.nodeId = node.id;
      el.style.left = `${node.x}px`;
      el.style.top = `${node.y}px`;
      el.setAttribute("node-type", node.type);

      el.innerHTML = `
        <div class="node-input"></div>
        <div class="node-header">
          <div class="node-icon ${node.type}">
            ${this.getNodeIcon(node.type)}
          </div>
          <div>
            <div class="node-title">${node.name}</div>
            <div class="node-label">${this.getTypeLabel(node.type)}</div>
          </div>
        </div>
        <div class="node-handle"></div>
        <div class="node-output"></div>
      `;

      // Drag handling
      let isDragging = false;
      let startX, startY, origX, origY;

      el.addEventListener("mousedown", (e) => {
        if (e.target.classList.contains("node-output") || e.target.classList.contains("node-input")) {
          this.startConnection(node, e);
          return;
        }
        e.stopPropagation();
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        origX = node.x;
        origY = node.y;
        this.selectNode(node.id);
      });

      el.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        const dx = (e.clientX - startX) / this.state.zoom;
        const dy = (e.clientY - startY) / this.state.zoom;
        let newX = origX + dx;
        let newY = origY + dy;

        if (this.state.settings.gridSnap) {
          newX = Math.round(newX / 24) * 24;
          newY = Math.round(newY / 24) * 24;
        }

        node.x = newX;
        node.y = newY;
        el.style.left = `${newX}px`;
        el.style.top = `${newY}px`;
        this.updateConnectionsForNode(node);
      });

      el.addEventListener("mouseup", () => {
        if (isDragging) {
          isDragging = false;
          this.saveWorkflowState();
        }
      });

      el.addEventListener("mouseenter", () => {
        el.querySelector(".node-output").style.background = "var(--cyan)";
      });
      el.addEventListener("mouseleave", () => {
        el.querySelector(".node-output").style.background = "var(--line)";
      });

      this.el.canvasNodes.appendChild(el);
    },

    getNodeIcon(type) {
      const icons = {
        trigger: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>',
        action: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect></svg>',
        condition: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path></svg>',
        transform: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><polyline points="20 17 14 11 20 5"></polyline></svg>',
        custom: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M12 1v6m0 6v6"></path></svg>',
      };
      return icons[type] || icons.action;
    },

    getTypeLabel(type) {
      const labels = {
        trigger: "Trigger",
        action: "Action",
        condition: "Condition",
        transform: "Transform",
        custom: "Custom",
      };
      return labels[type] || "Node";
    },

    startConnection(node, e) {
      e.stopPropagation();
      const connection = document.createElementNS("svg", "path");
      connection.setAttribute("stroke", "var(--cyan)");
      connection.setAttribute("stroke-width", "2");
      connection.setAttribute("fill", "none");
      connection.setAttribute("stroke-dasharray", "4 4");
      this.el.canvasConnections.appendChild(connection);

      const startX = node.x + 150;
      const startY = node.y + 30;

      const onMouseMove = (ev) => {
        const rect = this.el.canvasArea.getBoundingClientRect();
        const endX = (ev.clientX - rect.left - this.state.panX) / this.state.zoom;
        const endY = (ev.clientY - rect.top - this.state.panY) / this.state.zoom;
        this.drawConnection(connection, startX, startY, endX, endY);
      };

      const onMouseUp = (ev) => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        this.el.canvasConnections.removeChild(connection);

        const target = ev.target.closest(".node");
        if (target && target.dataset.nodeId !== node.id) {
          this.addConnection(node.id, target.dataset.nodeId);
        }
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },

    addConnection(from, to) {
      const id = `conn_${Date.now()}`;
      const conn = { id, from, to };
      this.state.connections.set(id, conn);
      this.renderConnection(conn);
      this.pushUndo();
      this.updateUI();
      this.saveWorkflowState();
    },

    renderConnection(conn) {
      const fromNode = this.state.nodes.get(conn.from);
      const toNode = this.state.nodes.get(conn.to);
      if (!fromNode || !toNode) return;

      const path = document.createElementNS("svg", "path");
      path.setAttribute("data-conn-id", conn.id);
      path.setAttribute("stroke", "var(--cyan)");
      path.setAttribute("stroke-width", "2");
      path.setAttribute("fill", "none");
      path.style.cursor = "pointer";
      path.style.pointerEvents = "stroke";

      path.addEventListener("click", () => {
        this.state.selectedConnection = conn.id;
        this.updateSelection();
      });

      this.el.canvasConnections.appendChild(path);
      this.updateConnectionPosition(conn);
    },

    updateConnectionPosition(conn) {
      const path = this.el.canvasConnections.querySelector(`[data-conn-id="${conn.id}"]`);
      if (!path) return;

      const fromNode = this.state.nodes.get(conn.from);
      const toNode = this.state.nodes.get(conn.to);
      if (!fromNode || !toNode) return;

      const x1 = fromNode.x + 150;
      const y1 = fromNode.y + 30;
      const x2 = toNode.x;
      const y2 = toNode.y + 30;

      this.drawConnection(path, x1, y1, x2, y2);
    },

    drawConnection(path, x1, y1, x2, y2) {
      const dx = Math.abs(x2 - x1) * 0.5;
      const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
      path.setAttribute("d", d);
    },

    updateConnectionsForNode(node) {
      this.state.connections.forEach((conn) => {
        if (conn.from === node.id || conn.to === node.id) {
          this.updateConnectionPosition(conn);
        }
      });
    },

    selectNode(id) {
      this.state.selectedNode = id;
      this.state.selectedConnection = null;
      this.updateSelection();
      this.showNodeProperties(id);
    },

    deleteSelectedNode() {
      if (!this.state.selectedNode) return;
      const id = this.state.selectedNode;
      this.state.nodes.delete(id);
      // Remove connections
      this.state.connections.forEach((conn, connId) => {
        if (conn.from === id || conn.to === id) {
          this.state.connections.delete(connId);
          const path = this.el.canvasConnections.querySelector(`[data-conn-id="${connId}"]`);
          if (path) this.el.canvasConnections.removeChild(path);
        }
      });
      const el = this.el.canvasNodes.querySelector(`[data-node-id="${id}"]`);
      if (el) el.remove();
      this.state.selectedNode = null;
      this.updateSelection();
      this.updateEmptyState();
      this.pushUndo();
      this.updateUI();
      this.saveWorkflowState();
    },

    updateSelection() {
      this.el.canvasNodes.querySelectorAll(".node").forEach((el) => {
        el.classList.toggle("selected", el.dataset.nodeId === this.state.selectedNode);
      });
      this.el.canvasConnections.querySelectorAll("path").forEach((el) => {
        el.setAttribute(
          "stroke",
          el.dataset.connId === this.state.selectedConnection ? "var(--coral)" : "var(--cyan)"
        );
      });
    },

    showNodeProperties(id) {
      const node = this.state.nodes.get(id);
      if (!node) return;

      this.el.nodeForm.hidden = false;
      this.el.nodeForm.classList.add("visible");
      this.el.paneProperties.querySelector(".empty-state").style.display = "none";

      this.el.nodeId.value = id;
      this.el.nodeType.value = node.type;
      this.el.nodeName.value = node.name;
      this.el.nodeDesc.value = node.desc || "";

      this.renderNodeConfig(node);
    },

    renderNodeConfig(node) {
      const config = this.el.nodeConfig;
      config.innerHTML = "";

      const definitions = this.getConfigDefs(node.type);
      const relevant = this.getRelevantConfigs(node.type, node.config.actionType);
      const keys = new Set(relevant.map((d) => d.key));

      definitions.forEach((def) => {
        if (!keys.has(def.key)) return;
        const item = document.createElement("div");
        item.className = "config-item";
        const value = node.config[def.key] || def.default || "";
        item.innerHTML = `
          <label>${def.label}</label>
          ${this.renderConfigInput(def, value)}
        `;
        config.appendChild(item);
      });

      // If action type changes, re-render config
      const actionTypeSelect = config.querySelector('[data-config-key="actionType"]');
      if (actionTypeSelect) {
        actionTypeSelect.addEventListener("change", () => {
          node.config.actionType = actionTypeSelect.value;
          this.renderNodeConfig(node);
        });
      }
    },

    getRelevantConfigs(type, actionType) {
      if (type === "action") {
        const always = [
          { key: "actionType", label: "Action Type", type: "select", options: ["HTTP Request", "Send Email", "Run Script", "Write File", "Notify"], default: "HTTP Request" },
        ];
        if (actionType === "Send Email") {
          return [...always, ...this.getConfigDefs("action").filter((d) => ["to", "subject", "text"].includes(d.key))];
        }
        if (actionType === "Run Script" || type === "custom") {
          return [...always, ...this.getConfigDefs("action").filter((d) => ["script", "lang"].includes(d.key))];
        }
        if (actionType === "Write File") {
          return [...always, ...this.getConfigDefs("action").filter((d) => ["path", "content"].includes(d.key))];
        }
        if (actionType === "Notify") {
          return [...always, ...this.getConfigDefs("action").filter((d) => ["title", "message"].includes(d.key))];
        }
        // HTTP Request (default)
        return [...always, ...this.getConfigDefs("action").filter((d) => ["url", "method", "headers", "body"].includes(d.key))];
      }
      return this.getConfigDefs(type);
    },

    renderConfigInput(def, value) {
      if (def.type === "select") {
        const options = def.options
          .map((opt) => `<option value="${opt}" ${opt === value ? "selected" : ""}>${opt}</option>`)
          .join("");
        return `<select data-config-key="${def.key}">${options}</select>`;
      }
      if (def.type === "textarea") {
        return `<textarea data-config-key="${def.key}" rows="${def.rows || 3}">${value}</textarea>`;
      }
      return `<input type="text" data-config-key="${def.key}" value="${value}">`;
    },

    getConfigDefs(type) {
      const defs = {
        trigger: [
          { key: "triggerType", label: "Trigger Type", type: "select", options: ["Manual", "Webhook", "Schedule", "File Watch"], default: "Manual" },
          { key: "schedule", label: "Schedule (cron)", type: "text", default: "0 * * * *" },
          { key: "path", label: "Watch Path", type: "text", default: "." },
        ],
        action: [
          { key: "actionType", label: "Action Type", type: "select", options: ["HTTP Request", "Send Email", "Run Script", "Write File", "Notify"], default: "HTTP Request" },
          { key: "url", label: "URL / Endpoint", type: "text", default: "https://api.github.com" },
          { key: "method", label: "Method", type: "select", options: ["GET", "POST", "PUT", "DELETE", "PATCH"], default: "GET" },
          { key: "headers", label: "Headers (JSON)", type: "textarea", default: '{\n  "Accept": "application/json"\n}' },
          { key: "body", label: "Request Body", type: "textarea", default: "" },
          { key: "to", label: "Email To", type: "text", default: "dm7178072@gmail.com" },
          { key: "subject", label: "Email Subject", type: "text", default: "Automation Notification" },
          { key: "text", label: "Email Body", type: "textarea", default: "Sent from Maurya Automation Suite" },
          { key: "script", label: "Script", type: "textarea", rows: 6, default: "return 'Hello from automation';" },
          { key: "lang", label: "Language", type: "select", options: ["javascript", "bash", "cmd"], default: "javascript" },
          { key: "path", label: "File Path", type: "text", default: "./output.txt" },
          { key: "content", label: "File Content", type: "textarea", rows: 6, default: "Generated by Maurya Automation" },
          { key: "title", label: "Notification Title", type: "text", default: "Maurya Automation" },
          { key: "message", label: "Notification Message", type: "textarea", default: "Workflow step completed" },
        ],
        condition: [
          { key: "condition", label: "Condition Expression", type: "textarea", default: "data && data.ok" },
        ],
        transform: [
          { key: "transform", label: "Transform Script", type: "textarea", rows: 6, default: "return data;" },
        ],
        custom: [
          { key: "script", label: "Custom Script", type: "textarea", rows: 8, default: "// Use 'data' (previous output) and 'vars'\nreturn data;" },
        ],
      };
      return defs[type] || [];
    },

    saveNodeProperties() {
      const id = this.el.nodeId.value;
      const node = this.state.nodes.get(id);
      if (!node) return;

      node.name = this.el.nodeName.value;
      node.desc = this.el.nodeDesc.value;

      this.el.nodeConfig.querySelectorAll("[data-config-key]").forEach((input) => {
        node.config[input.dataset.configKey] = input.value;
      });

      // Update DOM
      const el = this.el.canvasNodes.querySelector(`[data-node-id="${id}"]`);
      if (el) {
        el.querySelector(".node-title").textContent = node.name;
      }

      this.pushUndo();
      this.saveWorkflowState();
      this.toast("success", "Node updated", node.name);
    },

    updateEmptyState() {
      const hasNodes = this.state.nodes.size > 0;
      this.el.emptyCanvas.classList.toggle("visible", !hasNodes);
    },

    setZoom(zoom) {
      this.state.zoom = Math.max(0.3, Math.min(2, zoom));
      this.el.zoomDisplay.textContent = `${Math.round(this.state.zoom * 100)}%`;
      this.el.canvasNodes.style.transform = `scale(${this.state.zoom})`;
      this.el.canvasConnections.style.transform = `scale(${this.state.zoom})`;
      this.el.canvasGrid.style.backgroundSize = `${24 * this.state.zoom}px ${24 * this.state.zoom}px`;
    },

    fitToView() {
      if (this.state.nodes.size === 0) {
        this.setZoom(1);
        this.state.panX = 0;
        this.state.panY = 0;
        return;
      }
      // Simple fit calculation
      this.setZoom(1);
      this.toast("info", "View reset", "Zoom set to 100%");
    },

    updateMousePos(e) {
      const rect = this.el.canvasArea.getBoundingClientRect();
      const x = Math.round((e.clientX - rect.left - this.state.panX) / this.state.zoom);
      const y = Math.round((e.clientY - rect.top - this.state.panY) / this.state.zoom);
      this.el.mousePos.textContent = `${x}, ${y}`;
    },

    switchPanel(panel) {
      this.el.panelTabs.forEach((tab) => {
        tab.classList.toggle("active", tab.dataset.panel === panel);
      });
      this.el.paneProperties.classList.toggle("active", panel === "properties");
      this.el.paneLogs.classList.toggle("active", panel === "logs");
      this.el.paneDebug.classList.toggle("active", panel === "debug");
    },

    initLibrary() {
      const actions = this.getLibraryActions();
      this.el.libraryGrid.innerHTML = "";
      actions.forEach((action) => {
        const item = document.createElement("div");
        item.className = "library-item";
        item.dataset.category = action.category;
        item.dataset.name = action.name.toLowerCase();
        item.draggable = true;
        item.innerHTML = `
          ${action.icon}
          <h4>${action.name}</h4>
          <p>${action.desc}</p>
        `;
        item.addEventListener("dragstart", (e) => {
          e.dataTransfer.setData("text/plain", JSON.stringify(action));
        });
        item.addEventListener("dblclick", () => {
          this.addNode(action.nodeType || "action", 200, 200);
        });
        this.el.libraryGrid.appendChild(item);
      });

      // Drag and drop to canvas
      this.el.canvasArea.addEventListener("dragover", (e) => e.preventDefault());
      this.el.canvasArea.addEventListener("drop", (e) => {
        e.preventDefault();
        const data = e.dataTransfer.getData("text/plain");
        if (data) {
          const action = JSON.parse(data);
          const rect = this.el.canvasArea.getBoundingClientRect();
          const x = (e.clientX - rect.left - this.state.panX) / this.state.zoom - 90;
          const y = (e.clientY - rect.top - this.state.panY) / this.state.zoom - 20;
          this.addNode(action.nodeType || "action", x, y);
        }
      });
    },

    getLibraryActions() {
      return [
        { name: "HTTP Request", category: "http", nodeType: "action", icon: this.iconSvg("link"), desc: "Make GET/POST/PUT/DELETE requests" },
        { name: "Schedule Trigger", category: "trigger", nodeType: "trigger", icon: this.iconSvg("clock"), desc: "Run on cron schedule" },
        { name: "Webhook Trigger", category: "trigger", nodeType: "trigger", icon: this.iconSvg("webhook"), desc: "Start on incoming webhook" },
        { name: "File Watch", category: "file", nodeType: "trigger", icon: this.iconSvg("file"), desc: "Watch files for changes" },
        { name: "Send Email", category: "notify", nodeType: "action", icon: this.iconSvg("mail"), desc: "Send email notifications" },
        { name: "Slack Message", category: "notify", nodeType: "action", icon: this.iconSvg("slack"), desc: "Post to Slack channel" },
        { name: "Telegram Bot", category: "notify", nodeType: "action", icon: this.iconSvg("telegram"), desc: "Send Telegram message" },
        { name: "Write File", category: "file", nodeType: "action", icon: this.iconSvg("file-write"), desc: "Write data to file" },
        { name: "Read File", category: "file", nodeType: "action", icon: this.iconSvg("file-read"), desc: "Read file content" },
        { name: "Conditional Branch", category: "logic", nodeType: "condition", icon: this.iconSvg("branch"), desc: "Branch on condition" },
        { name: "JSON Transform", category: "data", nodeType: "transform", icon: this.iconSvg("transform"), desc: "Transform JSON data" },
        { name: "Data Filter", category: "data", nodeType: "transform", icon: this.iconSvg("filter"), desc: "Filter array data" },
        { name: "Loop", category: "logic", nodeType: "action", icon: this.iconSvg("loop"), desc: "Loop over items" },
        { name: "Delay", category: "logic", nodeType: "action", icon: this.iconSvg("delay"), desc: "Wait for duration" },
        { name: "Custom Script", category: "custom", nodeType: "custom", icon: this.iconSvg("code"), desc: "Run custom JavaScript" },
        { name: "Database Query", category: "data", nodeType: "action", icon: this.iconSvg("database"), desc: "Query database" },
      ];
    },

    iconSvg(type) {
      const paths = {
        link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>',
        clock: '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>',
        webhook: '<path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 1 1 4 13.01"></path><path d="M8 16.98h5.99c1.1 0 1.95-.94 2.48-1.9A4 4 0 1 1 20 11.01"></path>',
        file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline>',
        mail: '<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline>',
        slack: '<path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"></path><path d="M20.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"></path><path d="M3.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5z"></path>',
        telegram: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>',
        "file-write": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line>',
        "file-read": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M8 13h8M8 17h8M8 9h2"></path>',
        branch: '<line x1="6" y1="3" x2="6" y2="15"></line><circle cx="18" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><path d="M18 9a9 9 0 0 1-9 9"></path>',
        transform: '<polyline points="4 17 10 11 4 5"></polyline><polyline points="20 17 14 11 20 5"></polyline>',
        filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>',
        loop: '<polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path>',
        delay: '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>',
        code: '<polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline>',
        database: '<ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>',
      };
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${paths[type] || paths.code}</svg>`;
    },

    filterLibrary(query) {
      const search = (query || this.el.librarySearch.value).toLowerCase();
      const category = document.querySelector(".category-btn.active")?.dataset.category || "all";

      this.el.libraryGrid.querySelectorAll(".library-item").forEach((item) => {
        const matchesSearch = item.dataset.name.includes(search);
        const matchesCategory = category === "all" || item.dataset.category === category;
        item.style.display = matchesSearch && matchesCategory ? "flex" : "none";
      });
    },

    runWorkflow() {
      if (this.state.nodes.size === 0) {
        this.toast("warning", "No nodes", "Add nodes to your workflow first");
        return;
      }

      const run = {
        id: `run_${Date.now()}`,
        workflow: this.el.currentWorkflow.textContent,
        status: "running",
        startedAt: new Date(),
        nodes: this.state.nodes.size,
        logs: [],
      };
      this.state.currentRun = run;
      this.state.runs.unshift(run);
      this.updateRunBadge();
      this.renderRuns();

      this.switchPanel("logs");
      this.addLog("info", `Starting workflow: ${run.workflow}`);

      // Real execution through IPC bridge
      const nodes = Array.from(this.state.nodes.values());
      this.executeWorkflow(nodes, run);
    },

    async executeWorkflow(nodes, run) {
      const context = { vars: {}, lastOutput: null };
      let allSuccess = true;

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        node.status = "running";
        this.updateNodeStatus(node);
        this.addLog("info", `Executing node: ${node.name} (${node.type})`);

        try {
          const result = await this.executeNode(node, context);
          node.status = "success";
          node.output = result;
          this.updateNodeStatus(node);
          this.addLog("success", `${node.name} completed`);
          this.addLog("info", `↳ ${this.truncate(JSON.stringify(result), 200)}`);
          context.lastOutput = result;
          if (this.el.debugContext) {
            this.el.debugContext.textContent = JSON.stringify(context, null, 2);
          }
        } catch (err) {
          node.status = "failed";
          node.error = err.message;
          this.updateNodeStatus(node);
          this.addLog("error", `${node.name} failed: ${err.message}`);
          allSuccess = false;
          run.status = "failed";
          break;
        }
      }

      run.status = allSuccess ? "success" : "failed";
      run.duration = Date.now() - run.startedAt.getTime();
      this.updateRunBadge();
      this.renderRuns();
      this.addLog(
        allSuccess ? "success" : "error",
        `Workflow ${allSuccess ? "completed successfully" : "failed"}`
      );
      this.toast(
        allSuccess ? "success" : "error",
        allSuccess ? "Workflow complete" : "Workflow failed",
        `${nodes.length} nodes processed`
      );
    },

    async executeNode(node, context) {
      const cfg = node.config || {};
      switch (node.type) {
        case "trigger": {
          const t = cfg.triggerType || "Manual";
          if (t === "Schedule") {
            return { triggered: true, type: "schedule", schedule: cfg.schedule || "0 * * * *" };
          }
          if (t === "Webhook") {
            return { triggered: true, type: "webhook" };
          }
          if (t === "File Watch") {
            return { triggered: true, type: "file-watch", path: cfg.path || "." };
          }
          return { triggered: true, type: "manual" };
        }
        case "action": {
          const at = cfg.actionType || "HTTP Request";
          if (at === "HTTP Request") {
            return await window.maurya.httpRequest({
              url: cfg.url,
              method: cfg.method || "GET",
              headers: this.parseHeaders(cfg.headers),
              body: cfg.body || undefined,
            });
          }
          if (at === "Send Email") {
            return await window.maurya.sendEmail({
              to: cfg.to,
              subject: cfg.subject || node.name,
              text: cfg.text,
              html: cfg.html,
            });
          }
          if (at === "Run Script") {
            return await window.maurya.runScript(cfg.script || "", cfg.lang || "javascript");
          }
          if (at === "Write File") {
            return await window.maurya.writeFile(cfg.path, cfg.content || "");
          }
          if (at === "Notify") {
            return await window.maurya.executeAction("notify", {
              title: cfg.title || node.name,
              message: cfg.message || "",
            });
          }
          throw new Error(`Unknown action type: ${at}`);
        }
        case "condition": {
          const expr = cfg.condition || "true";
          let pass = false;
          try {
            pass = !!new Function("data", "vars", `return (${expr});`)(context.lastOutput, context.vars);
          } catch (e) {
            throw new Error(`Condition error: ${e.message}`);
          }
          node.branch = pass ? "true" : "false";
          this.addLog("info", `Condition "${expr}" → ${pass ? "PASS" : "FAIL"}`);
          return { passed: pass, expression: expr };
        }
        case "transform": {
          const script = cfg.transform || "return data;";
          const fn = new Function("data", "vars", script);
          const out = fn(context.lastOutput, context.vars);
          return out;
        }
        case "custom": {
          return await window.maurya.runScript(cfg.script || "", "javascript");
        }
        default:
          throw new Error(`Unknown node type: ${node.type}`);
      }
    },

    parseHeaders(raw) {
      if (!raw) return {};
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    },

    truncate(str, n) {
      return str.length > n ? str.slice(0, n) + "…" : str;
    },

    updateNodeStatus(node) {
      const el = this.el.canvasNodes.querySelector(`[data-node-id="${node.id}"]`);
      if (el) {
        el.classList.remove("node-running", "node-success", "node-failed");
        if (node.status === "running") el.classList.add("node-running");
        if (node.status === "success") el.classList.add("node-success");
        if (node.status === "failed") el.classList.add("node-failed");
      }
    },

    deployWorkflow() {
      this.toast("info", "Deploying...", "Preparing workflow for deployment");
      setTimeout(() => {
        this.toast("success", "Deployed", "Workflow is now active");
      }, 1500);
    },

    updateRunBadge() {
      const running = this.state.runs.filter((r) => r.status === "running").length;
      this.el.runBadge.hidden = running === 0;
      this.el.runBadge.textContent = running;
    },

    renderRuns() {
      const filterStatus = this.el.runsFilterStatus.value;
      const filterWorkflow = this.el.runsFilterWorkflow.value;

      const runs = this.state.runs.filter((run) => {
        if (filterStatus !== "all" && run.status !== filterStatus) return false;
        if (filterWorkflow !== "all" && run.workflow !== filterWorkflow) return false;
        return true;
      });

      if (runs.length === 0) {
        this.el.runsBody.innerHTML = `
          <tr class="runs-empty">
            <td colspan="6">No executions yet. Create a workflow and click <strong>Run</strong>.</td>
          </tr>
        `;
        return;
      }

      this.el.runsBody.innerHTML = runs
        .map(
          (run) => `
          <tr data-run-id="${run.id}">
            <td>${run.workflow}</td>
            <td><span class="status-badge ${run.status}">${run.status}</span></td>
            <td>${run.startedAt.toLocaleTimeString()}</td>
            <td>${run.duration ? `${(run.duration / 1000).toFixed(1)}s` : "—"}</td>
            <td>${run.nodes}</td>
            <td><button class="btn btn-ghost compact" data-view-run="${run.id}">View</button></td>
          </tr>
        `
        )
        .join("");

      this.el.runsBody.querySelectorAll("[data-view-run]").forEach((btn) => {
        btn.addEventListener("click", () => this.viewRun(btn.dataset.viewRun));
      });
    },

    viewRun(id) {
      const run = this.state.runs.find((r) => r.id === id);
      if (!run) return;

      this.el.runDetail.hidden = false;
      this.el.runDetailContent.innerHTML = `
        <div class="run-header">
          <h3>${run.workflow}</h3>
          <span class="status-badge ${run.status}">${run.status}</span>
        </div>
        <div class="run-meta">
          <p><strong>Started:</strong> ${run.startedAt.toLocaleString()}</p>
          <p><strong>Duration:</strong> ${run.duration ? `${(run.duration / 1000).toFixed(1)}s` : "Running..."}</p>
          <p><strong>Nodes:</strong> ${run.nodes}</p>
        </div>
        <div class="run-logs">
          <h4>Execution Log</h4>
          <pre class="debug-pre">${run.logs.join("\n")}</pre>
        </div>
      `;
    },

    addLog(level, message) {
      const timestamp = new Date().toLocaleTimeString();
      const entry = { time: timestamp, level, message };
      this.state.logs.push(entry);
      if (this.state.currentRun) {
        this.state.currentRun.logs.push(`${timestamp} [${level}] ${message}`);
      }
      this.renderLogs();
    },

    renderLogs() {
      const filter = this.el.logFilter.value;
      const logs = this.state.logs.filter((l) => filter === "all" || l.level === filter);

      if (logs.length === 0) {
        this.el.logEntries.innerHTML = `<div class="log-empty">No logs to display</div>`;
        return;
      }

      this.el.logEntries.innerHTML = logs
        .map(
          (log) => `
          <div class="log-entry ${log.level}">
            <span class="log-time">${log.time}</span>
            <span class="log-message">${log.message}</span>
          </div>
        `
        )
        .join("");
      this.el.logEntries.scrollTop = this.el.logEntries.scrollHeight;
    },

    initSettings() {
      // Load settings
      Object.keys(this.state.settings).forEach((key) => {
        const saved = localStorage.getItem(`maurya-settings-${key}`);
        if (saved !== null) {
          this.state.settings[key] = saved === "true" || saved === "false" ? saved === "true" : saved;
        }
      });

      // Bind setting inputs
      const settingsMap = {
        "setting-autosave": "autosave",
        "setting-confirm-run": "confirmRun",
        "setting-minimap": "minimap",
        "setting-gridsnap": "gridSnap",
        "setting-template": "template",
        "setting-reduce-motion": "reduceMotion",
        "setting-compact": "compact",
        "setting-devtools": "devtools",
        "setting-debug": "debug",
        "setting-telemetry": "telemetry",
      };

      Object.entries(settingsMap).forEach(([elId, key]) => {
        const el = document.getElementById(elId);
        if (el) {
          if (el.type === "checkbox") el.checked = this.state.settings[key];
          else el.value = this.state.settings[key];
          el.addEventListener("change", () => {
            this.state.settings[key] = el.type === "checkbox" ? el.checked : el.value;
            localStorage.setItem(`maurya-settings-${key}`, this.state.settings[key]);
            this.applySettings();
          });
        }
      });

      // Theme radios
      document.querySelectorAll('input[name="theme"]').forEach((radio) => {
        radio.addEventListener("change", () => {
          if (radio.checked) this.setTheme(radio.value);
        });
      });

      // Accent colors
      const accents = ["cyan", "electric", "lime", "coral", "violet", "amber"];
      const accentContainer = document.getElementById("accent-options");
      accents.forEach((accent) => {
        const btn = document.createElement("div");
        btn.className = "accent-option";
        btn.dataset.accent = accent;
        btn.style.background = `var(--${accent})`;
        if (this.state.settings.accent === accent) btn.classList.add("active");
        btn.addEventListener("click", () => {
          this.state.settings.accent = accent;
          localStorage.setItem("maurya-settings-accent", accent);
          document.querySelectorAll(".accent-option").forEach((o) => o.classList.toggle("active", o.dataset.accent === accent));
          document.documentElement.style.setProperty("--accent", `var(--${accent})`);
        });
        accentContainer.appendChild(btn);
      });
      document.documentElement.style.setProperty("--accent", `var(--${this.state.settings.accent})`);

      // About version
      document.querySelectorAll("[data-app-version]").forEach((el) => {
        el.textContent = "1.0.2";
      });

      this.applySettings();
    },

    applySettings() {
      const s = this.state.settings;
      document.body.classList.toggle("reduce-motion", s.reduceMotion);
      document.body.classList.toggle("compact-mode", s.compact);
      this.el.canvasMinimap.style.display = s.minimap ? "block" : "none";
      this.el.gridSnap.textContent = s.gridSnap ? "Snap: On" : "Snap: Off";
    },

    switchSetting(setting) {
      this.el.settingNavItems.forEach((item) => {
        item.classList.toggle("active", item.dataset.setting === setting);
      });
      document.querySelectorAll(".setting-pane").forEach((pane) => {
        pane.classList.toggle("active", pane.id === `setting-${setting}`);
      });
    },

    initShortcuts() {
      const shortcutsBody = document.getElementById("shortcuts-body");
      const shortcuts = [
        { action: "New Workflow", key: "Ctrl+N" },
        { action: "Save Workflow", key: "Ctrl+S" },
        { action: "Undo", key: "Ctrl+Z" },
        { action: "Redo", key: "Ctrl+Shift+Z" },
        { action: "Canvas View", key: "1" },
        { action: "Library View", key: "2" },
        { action: "Runs View", key: "3" },
        { action: "Settings View", key: "4" },
        { action: "Select Tool", key: "V" },
        { action: "Pan Tool", key: "H" },
        { action: "Zoom In", key: "+" },
        { action: "Zoom Out", key: "-" },
        { action: "Fit to View", key: "0" },
        { action: "Delete Selected", key: "Del" },
      ];
      shortcutsBody.innerHTML = shortcuts
        .map(
          (s) => `
          <tr>
            <td>${s.action}</td>
            <td><kbd>${s.key}</kbd></td>
          </tr>
        `
        )
        .join("");
    },

    handleKeydown(e) {
      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && key === "n") {
        e.preventDefault();
        this.newWorkflow();
      } else if (ctrl && key === "s") {
        e.preventDefault();
        this.saveWorkflow();
      } else if (ctrl && key === "z" && !e.shiftKey) {
        e.preventDefault();
        this.undo();
      } else if (ctrl && key === "z" && e.shiftKey) {
        e.preventDefault();
        this.redo();
      } else if (ctrl && key === "a") {
        e.preventDefault();
        this.state.nodes.forEach((n) => this.selectNode(n.id));
      } else if (key === "delete" || key === "backspace") {
        if (this.state.selectedNode && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
          this.deleteSelectedNode();
        }
      } else if (key === "v") {
        this.setTool("select");
      } else if (key === "h") {
        this.setTool("pan");
      } else if (key === "1") {
        this.switchView("canvas");
      } else if (key === "2") {
        this.switchView("library");
      } else if (key === "3") {
        this.switchView("runs");
      } else if (key === "4") {
        this.switchView("settings");
      } else if (key === "+" || key === "=") {
        this.setZoom(this.state.zoom * 1.2);
      } else if (key === "-" || key === "_") {
        this.setZoom(this.state.zoom / 1.2);
      } else if (key === "0") {
        this.fitToView();
      }
    },

    setTool(tool) {
      document.querySelectorAll(".tool-btn[data-tool]").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.tool === tool);
      });
    },

    newWorkflow() {
      if (this.state.nodes.size > 0 && this.state.settings.confirmRun) {
        if (!confirm("Start a new workflow? Unsaved changes will be lost.")) return;
      }
      this.state.nodes.clear();
      this.state.connections.clear();
      this.state.selectedNode = null;
      this.el.canvasNodes.innerHTML = "";
      this.el.canvasConnections.innerHTML = "";
      this.updateEmptyState();
      this.updateUI();
      this.el.currentWorkflow.textContent = "Untitled Workflow";
      this.state.workflow = { name: "Untitled Workflow", nodes: [], connections: [] };
      this.pushUndo();
      this.saveWorkflowState();
      this.toast("info", "New workflow", "Canvas cleared");
    },

    saveWorkflow() {
      this.state.workflow = {
        name: this.el.currentWorkflow.textContent || "Untitled Workflow",
        nodes: Array.from(this.state.nodes.values()),
        connections: Array.from(this.state.connections.values()),
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem("maurya-workflow", JSON.stringify(this.state.workflow));
      this.el.lastSaved.textContent = `Saved ${new Date().toLocaleTimeString()}`;
      this.toast("success", "Workflow saved", this.state.workflow.name);
    },

    saveWorkflowState() {
      if (!this.state.settings.autosave) return;
      this.state.workflow = {
        name: this.el.currentWorkflow.textContent || "Untitled Workflow",
        nodes: Array.from(this.state.nodes.values()),
        connections: Array.from(this.state.connections.values()),
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem("maurya-workflow", JSON.stringify(this.state.workflow));
      this.el.lastSaved.textContent = `Auto-saved ${new Date().toLocaleTimeString()}`;
    },

    loadWorkflow() {
      const saved = localStorage.getItem("maurya-workflow");
      if (saved) {
        try {
          const workflow = JSON.parse(saved);
          this.state.workflow = workflow;
          this.el.currentWorkflow.textContent = workflow.name || "Untitled Workflow";
          workflow.nodes?.forEach((node) => {
            this.state.nodes.set(node.id, node);
            this.renderNode(node);
          });
          workflow.connections?.forEach((conn) => {
            this.state.connections.set(conn.id, conn);
            this.renderConnection(conn);
          });
          this.updateEmptyState();
          this.el.lastSaved.textContent = "Loaded from cache";
        } catch (e) {
          console.error("Failed to load workflow:", e);
        }
      }
    },

    pushUndo() {
      this.state.undoStack.push({
        nodes: JSON.stringify(Array.from(this.state.nodes.values())),
        connections: JSON.stringify(Array.from(this.state.connections.values())),
      });
      if (this.state.undoStack.length > 50) this.state.undoStack.shift();
      this.el.btnUndo.disabled = false;
      this.state.redoStack = [];
      this.el.btnRedo.disabled = true;
    },

    undo() {
      if (this.state.undoStack.length === 0) return;
      const state = this.state.undoStack.pop();
      this.state.redoStack.push({
        nodes: JSON.stringify(Array.from(this.state.nodes.values())),
        connections: JSON.stringify(Array.from(this.state.connections.values())),
      });
      this.restoreState(state);
      this.el.btnUndo.disabled = this.state.undoStack.length === 0;
      this.el.btnRedo.disabled = false;
    },

    redo() {
      if (this.state.redoStack.length === 0) return;
      const state = this.state.redoStack.pop();
      this.state.undoStack.push({
        nodes: JSON.stringify(Array.from(this.state.nodes.values())),
        connections: JSON.stringify(Array.from(this.state.connections.values())),
      });
      this.restoreState(state);
      this.el.btnRedo.disabled = this.state.redoStack.length === 0;
      this.el.btnUndo.disabled = false;
    },

    restoreState(state) {
      this.state.nodes.clear();
      this.state.connections.clear();
      JSON.parse(state.nodes).forEach((node) => {
        this.state.nodes.set(node.id, node);
        this.renderNode(node);
      });
      JSON.parse(state.connections).forEach((conn) => {
        this.state.connections.set(conn.id, conn);
        this.renderConnection(conn);
      });
      this.updateEmptyState();
      this.updateUI();
    },

    updateUI() {
      this.el.nodeCount.textContent = `${this.state.nodes.size} node${this.state.nodes.size !== 1 ? "s" : ""}`;
      this.el.connectionCount.textContent = `${this.state.connections.size} connection${this.state.connections.size !== 1 ? "s" : ""}`;
      this.updateRunBadge();
    },

    initExternalLinks() {
      document.querySelectorAll('a[href^="http:"], a[href^="https:"], a[href^="mailto:"]').forEach((link) => {
        link.addEventListener("click", (event) => {
          event.preventDefault();
          window.open(link.href, "_blank", "noopener,noreferrer");
        });
      });
    },

    closeModal() {
      this.el.modalOverlay.hidden = true;
      this.el.modalBody.innerHTML = "";
      this.el.modalFooter.innerHTML = "";
    },

    toast(type, title, message) {
      const toast = document.createElement("div");
      toast.className = `toast toast-${type}`;
      const icons = { info: "ℹ", success: "✓", error: "✕", warning: "⚠" };
      toast.innerHTML = `
        <div class="toast-icon">${icons[type] || "ℹ"}</div>
        <div class="toast-content">
          <h4>${title}</h4>
          <p>${message || ""}</p>
        </div>
        <button class="toast-close" aria-label="Close">×</button>
      `;
      toast.querySelector(".toast-close").addEventListener("click", () => toast.remove());
      this.el.toastContainer.appendChild(toast);
      setTimeout(() => {
        if (toast.parentNode) toast.remove();
      }, 4000);
    },
  };

  document.addEventListener("DOMContentLoaded", () => App.init());
})();
