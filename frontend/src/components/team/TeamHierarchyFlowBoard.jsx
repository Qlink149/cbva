import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Sparkles, Search, X, ArrowRight,
  ZoomIn, ZoomOut, Maximize2,
} from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  RootNode, L1Card, L2Card, L3Card, L4Card, EntityDetailsDrawer,
} from '@/components/team/hierarchyCards';

const CARD_WIDTH = 290;
const CARD_HEIGHT = 130;
const HORIZONTAL_GAP = 50;
const LEVEL_HEIGHTS = [60, 260, 480, 700, 920];

const getPathData = (from, to) => `M ${from.x} ${from.y} L ${to.x} ${to.y}`;

const getConnectionColors = (fromId, isHighlighted) => {
  const t = fromId.split('-')[0];
  if (isHighlighted) {
    if (t === 'admin') return 'var(--color-primary, #6366f1)';
    if (t === 'l1') return '#6366f1';
    if (t === 'l2') return '#10b981';
    if (t === 'l3') return '#8b5cf6';
    return 'var(--color-primary, #6366f1)';
  }
  if (t === 'l1') return 'rgba(99,102,241,0.25)';
  if (t === 'l2') return 'rgba(16,185,129,0.25)';
  if (t === 'l3') return 'rgba(139,92,246,0.25)';
  return 'var(--color-border, #e2e8f0)';
};

const getMarkerId = (fromId, isHighlighted) => {
  if (!isHighlighted) return 'arrow-muted';
  const t = fromId.split('-')[0];
  if (t === 'admin') return 'arrow-admin';
  if (t === 'l1') return 'arrow-l1';
  if (t === 'l2') return 'arrow-l2';
  if (t === 'l3') return 'arrow-l3';
  return 'arrow-muted';
};

function countChildren(id, type, hierarchy, expandedL1, expandedL2, expandedL3) {
  if (type === 'admin') return hierarchy.l1.length;
  if (type === 'l1') {
    if (!expandedL1.has(id)) return hierarchy.l2.filter((e) => e.parentId === id).length;
    return hierarchy.l2.filter((e) => e.parentId === id).length;
  }
  if (type === 'l2') return hierarchy.l3.filter((e) => e.parentId === id).length;
  if (type === 'l3') return hierarchy.l4.filter((e) => e.parentId === id).length;
  return 0;
}

export function TeamHierarchyFlowBoard({
  hierarchy,
  title = 'Organisational Structure',
  subtitle,
  mode = 'leader',
}) {
  const containerRef = useRef(null);
  const activePointers = useRef({});
  const lastTouchDistance = useRef(null);

  const [scale, setScale] = useState(0.85);
  const [pan, setPan] = useState({ x: 150, y: 30 });
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [expandedL1, setExpandedL1] = useState(new Set());
  const [expandedL2, setExpandedL2] = useState(new Set());
  const [expandedL3, setExpandedL3] = useState(new Set());

  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedNodeId, setHighlightedNodeId] = useState(null);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState(null);

  const entityL1s = hierarchy?.l1 ?? [];
  const entityL2s = hierarchy?.l2 ?? [];
  const entityL3s = hierarchy?.l3 ?? [];
  const entityL4s = hierarchy?.l4 ?? [];

  const handleResetView = () => {
    setScale(0.85);
    const w = containerRef.current?.clientWidth ?? 800;
    setPan({ x: w / 2 - 50, y: 40 });
    setHighlightedNodeId(null);
  };

  useEffect(() => {
    if (entityL1s.length > 0 && expandedL1.size === 0) {
      setExpandedL1(new Set([entityL1s[0].id]));
    }
  }, [entityL1s]);

  useEffect(() => {
    handleResetView();
  }, [hierarchy?.rootTitle, mode]);

  const handleZoom = (factor) =>
    setScale((prev) => Math.min(Math.max(prev * factor, 0.3), 1.8));

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setScale((prev) => {
        const next = Math.min(Math.max(prev + (-e.deltaY * 0.05 * 0.01), 0.25), 1.8);
        setPan((p) => ({
          x: mx - ((mx - p.x) / prev) * next,
          y: my - ((my - p.y) / prev) * next,
        }));
        return next;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handlePointerDown = (e) => {
    if ((e.target).closest('.flow-card-node') || (e.target).closest('.floating-toolbar')) return;
    activePointers.current[e.pointerId] = { x: e.clientX, y: e.clientY };
    const ids = Object.keys(activePointers.current);
    if (ids.length === 1) {
      containerRef.current?.setPointerCapture(e.pointerId);
      setIsPanning(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    } else if (ids.length === 2) {
      setIsPanning(false);
      const pts = Object.values(activePointers.current);
      lastTouchDistance.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    }
  };

  const handlePointerMove = (e) => {
    if (activePointers.current[e.pointerId]) {
      activePointers.current[e.pointerId] = { x: e.clientX, y: e.clientY };
    }
    const ids = Object.keys(activePointers.current);
    if (ids.length === 1 && isPanning) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    } else if (ids.length === 2 && lastTouchDistance.current !== null) {
      const pts = Object.values(activePointers.current);
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const factor = dist / lastTouchDistance.current;
      lastTouchDistance.current = dist;
      const el = containerRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const mx = (pts[0].x + pts[1].x) / 2 - rect.left;
        const my = (pts[0].y + pts[1].y) / 2 - rect.top;
        setScale((prev) => {
          const next = Math.min(Math.max(prev * factor, 0.25), 1.8);
          setPan((p) => ({ x: mx - ((mx - p.x) / prev) * next, y: my - ((my - p.y) / prev) * next }));
          return next;
        });
      }
    }
  };

  const handlePointerUp = (e) => {
    delete activePointers.current[e.pointerId];
    if (Object.keys(activePointers.current).length < 2) lastTouchDistance.current = null;
    if (Object.keys(activePointers.current).length === 0 && isPanning) {
      try { containerRef.current?.releasePointerCapture(e.pointerId); } catch { /* noop */ }
      setIsPanning(false);
    }
  };

  const handlePointerCancel = (e) => {
    delete activePointers.current[e.pointerId];
    lastTouchDistance.current = null;
    if (isPanning) setIsPanning(false);
  };

  const toggle = (set, id) =>
    set((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const expandAll = () => {
    setExpandedL1(new Set(entityL1s.map((e) => e.id)));
    setExpandedL2(new Set(entityL2s.map((e) => e.id)));
    setExpandedL3(new Set(entityL3s.map((e) => e.id)));
  };

  const collapseAll = () => {
    setExpandedL1(new Set());
    setExpandedL2(new Set());
    setExpandedL3(new Set());
  };

  const { nodes, connections } = useMemo(() => {
    const computedNodes = [];
    const computedConnections = [];
    const subtreeWidths = {};

    const getChildren = (id, type) => {
      if (type === 'admin') return entityL1s.map((e) => ({ id: e.id, type: 'l1' }));
      if (type === 'l1') {
        if (!expandedL1.has(id)) return [];
        return entityL2s.filter((e) => e.parentId === id).map((e) => ({ id: e.id, type: 'l2' }));
      }
      if (type === 'l2') {
        if (!expandedL2.has(id)) return [];
        return entityL3s.filter((e) => e.parentId === id).map((e) => ({ id: e.id, type: 'l3' }));
      }
      if (type === 'l3') {
        if (!expandedL3.has(id)) return [];
        return entityL4s.filter((e) => e.parentId === id).map((e) => ({ id: e.id, type: 'l4' }));
      }
      return [];
    };

    const computeWidth = (id, type) => {
      const key = `${type}-${id}`;
      const children = getChildren(id, type);
      if (!children.length) {
        subtreeWidths[key] = CARD_WIDTH + HORIZONTAL_GAP;
        return CARD_WIDTH + HORIZONTAL_GAP;
      }
      let w = 0;
      for (const c of children) w += computeWidth(c.id, c.type);
      subtreeWidths[key] = w;
      return w;
    };
    computeWidth('root', 'admin');

    const assignPositions = (id, type, parentX, level, parentId) => {
      const key = `${type}-${id}`;
      const y = LEVEL_HEIGHTS[level];
      const children = getChildren(id, type);
      let data = null;
      if (type === 'l1') data = entityL1s.find((e) => e.id === id);
      if (type === 'l2') data = entityL2s.find((e) => e.id === id);
      if (type === 'l3') data = entityL3s.find((e) => e.id === id);
      if (type === 'l4') data = entityL4s.find((e) => e.id === id);

      computedNodes.push({
        id: key, type, x: parentX, y, width: subtreeWidths[key] || CARD_WIDTH + HORIZONTAL_GAP, data, parentId,
      });
      if (!children.length) return;

      let currentX = parentX - subtreeWidths[key] / 2;
      for (const child of children) {
        const childKey = `${child.type}-${child.id}`;
        const childW = subtreeWidths[childKey];
        const childX = currentX + childW / 2;
        assignPositions(child.id, child.type, childX, level + 1, key);
        computedConnections.push({
          from: key,
          to: childKey,
          fromCoord: { x: parentX, y: y + (type === 'admin' ? 40 : CARD_HEIGHT / 2) },
          toCoord: { x: childX, y: LEVEL_HEIGHTS[level + 1] - CARD_HEIGHT / 2 },
        });
        currentX += childW;
      }
    };
    assignPositions('root', 'admin', 0, 0);
    return { nodes: computedNodes, connections: computedConnections };
  }, [entityL1s, entityL2s, entityL3s, entityL4s, expandedL1, expandedL2, expandedL3]);

  const handleFocusNode = (node) => {
    const [nodeType, ...rest] = node.id.split('-');
    const nodeId = rest.join('-');

    if (nodeType === 'l4') {
      const item = entityL4s.find((e) => e.id === nodeId);
      if (item) {
        const parent3 = entityL3s.find((e) => e.id === item.parentId);
        if (parent3) {
          setExpandedL1((p) => new Set([...p, parent3.grandparentId || parent3.parentId]));
          setExpandedL2((p) => new Set([...p, parent3.parentId]));
          setExpandedL3((p) => new Set([...p, parent3.id]));
        }
      }
    } else if (nodeType === 'l3') {
      const item = entityL3s.find((e) => e.id === nodeId);
      if (item) {
        setExpandedL1((p) => new Set([...p, item.grandparentId]));
        setExpandedL2((p) => new Set([...p, item.parentId]));
      }
    } else if (nodeType === 'l2') {
      const item = entityL2s.find((e) => e.id === nodeId);
      if (item) setExpandedL1((p) => new Set([...p, item.parentId]));
    } else if (nodeType === 'l1') {
      setExpandedL1((p) => new Set([...p, nodeId]));
    }

    setTimeout(() => {
      setHighlightedNodeId(node.id);
      const w = containerRef.current?.clientWidth || 800;
      const h = containerRef.current?.clientHeight || 600;
      setScale(1.0);
      setPan({ x: w / 2 - node.x, y: h / 2 - node.y });
    }, 100);
    setShowSearchDropdown(false);
    setSearchQuery('');
  };

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const results = [];

    entityL1s.forEach((e) => {
      if (e.name.toLowerCase().includes(q)) {
        results.push({
          label: e.name,
          sub: e.isLeader ? 'Business Leader' : e.isTier ? 'Designation Tier' : 'Senior Staff',
          node: nodes.find((n) => n.id === `l1-${e.id}`) || { id: `l1-${e.id}`, x: 0, y: LEVEL_HEIGHTS[1] },
        });
      }
    });
    entityL2s.forEach((e) => {
      if (e.name.toLowerCase().includes(q)) {
        results.push({
          label: e.name,
          sub: e.designation || 'Team Member',
          node: nodes.find((n) => n.id === `l2-${e.id}`) || { id: `l2-${e.id}`, x: 0, y: LEVEL_HEIGHTS[2] },
        });
      }
    });
    entityL3s.forEach((e) => {
      if ((e.title || e.name || '').toLowerCase().includes(q)) {
        results.push({
          label: e.title || e.name,
          sub: e.designation || 'Team Member',
          node: nodes.find((n) => n.id === `l3-${e.id}`) || { id: `l3-${e.id}`, x: 0, y: LEVEL_HEIGHTS[3] },
        });
      }
    });
    entityL4s.forEach((e) => {
      if ((e.title || e.name || '').toLowerCase().includes(q)) {
        results.push({
          label: e.title || e.name,
          sub: e.designation || 'Junior Staff',
          node: nodes.find((n) => n.id === `l4-${e.id}`) || { id: `l4-${e.id}`, x: 0, y: LEVEL_HEIGHTS[4] },
        });
      }
    });
    return results.slice(0, 8);
  }, [searchQuery, entityL1s, entityL2s, entityL3s, entityL4s, nodes]);

  const legendItems = mode === 'firmwide'
    ? [
      { color: 'bg-indigo-500', label: 'Business Leaders' },
      { color: 'bg-indigo-500', label: 'Designation Tiers' },
      { color: 'bg-emerald-500', label: 'Managers / Members' },
      { color: 'bg-violet-500', label: 'Team Members' },
      { color: 'bg-sky-500', label: 'Junior Staff' },
    ]
    : [
      { color: 'bg-indigo-500', label: 'Tiers / Senior Staff' },
      { color: 'bg-emerald-500', label: 'Managers / Members' },
      { color: 'bg-violet-500', label: 'Team Members' },
      { color: 'bg-sky-500', label: 'Junior Staff' },
    ];

  if (!hierarchy || entityL1s.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground italic">No team members to display in the hierarchy yet.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-2xl border border-muted-foreground/15 bg-background shadow-xl select-none overflow-hidden h-[720px] flex flex-col">
      <div className="z-20 border-b border-border bg-card/65 backdrop-blur-md px-6 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/20">
            <Activity className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
              {title}
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-500 border border-indigo-500/20">
                <Sparkles className="h-2.5 w-2.5" /> Canvas Mode
              </span>
            </h2>
            <p className="text-xs text-muted-foreground">{subtitle || hierarchy.rootSubtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px]">
            <div className="flex h-9 items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs text-muted-foreground shadow-sm focus-within:ring-1 focus-within:ring-ring">
              <Search className="h-3.5 w-3.5" />
              <input
                type="text"
                placeholder="Search team members..."
                className="w-full bg-transparent border-0 outline-none text-foreground text-xs"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setShowSearchDropdown(true); }}
                onFocus={() => setShowSearchDropdown(true)}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            {showSearchDropdown && searchResults.length > 0 && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowSearchDropdown(false)} />
                <div className="absolute left-0 right-0 mt-2 z-40 max-h-80 overflow-y-auto rounded-xl border bg-popover shadow-xl p-1.5">
                  <div className="px-2.5 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b">Results</div>
                  {searchResults.map((res, i) => (
                    <button
                      key={i}
                      onClick={() => handleFocusNode(res.node)}
                      className="w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs hover:bg-accent hover:text-accent-foreground transition-colors group"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate group-hover:text-primary">{res.label}</p>
                        <p className="text-[10px] text-muted-foreground">{res.sub}</p>
                      </div>
                      <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all" />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 bg-muted/65 p-1 rounded-lg border">
            <button onClick={expandAll} className="px-2.5 py-1.5 text-xs font-semibold rounded-md hover:bg-card hover:text-foreground transition-all text-muted-foreground">Expand All</button>
            <button onClick={collapseAll} className="px-2.5 py-1.5 text-xs font-semibold rounded-md hover:bg-card hover:text-foreground transition-all text-muted-foreground">Collapse All</button>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className={`flex-1 relative overflow-hidden bg-background outline-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          touchAction: 'none',
          backgroundImage: 'radial-gradient(circle, var(--color-border, #e2e8f0) 1.2px, transparent 1.2px)',
          backgroundSize: '28px 28px',
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <motion.div
          className="absolute origin-top-left"
          style={{ x: pan.x, y: pan.y, scale }}
          animate={isPanning ? undefined : { x: pan.x, y: pan.y, scale }}
          transition={{ type: 'spring', damping: 30, stiffness: 220 }}
        >
          <svg className="absolute overflow-visible pointer-events-none top-0 left-0" style={{ width: '1px', height: '1px' }}>
            <defs>
              {[
                { id: 'arrow-admin', fill: 'var(--color-primary, #6366f1)' },
                { id: 'arrow-l1', fill: '#6366f1' },
                { id: 'arrow-l2', fill: '#10b981' },
                { id: 'arrow-l3', fill: '#8b5cf6' },
                { id: 'arrow-muted', fill: 'var(--color-border, #e2e8f0)' },
              ].map((m) => (
                <marker key={m.id} id={m.id} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill={m.fill} />
                </marker>
              ))}
            </defs>

            <AnimatePresence>
              {connections.map((conn) => {
                const endPt = { x: conn.toCoord.x, y: conn.toCoord.y - 6 };
                const pathData = getPathData(conn.fromCoord, endPt);
                const isH = highlightedNodeId === conn.to || highlightedNodeId === conn.from;
                const color = getConnectionColors(conn.from, isH);
                const marker = getMarkerId(conn.from, isH);
                return (
                  <motion.g key={`${conn.from}-${conn.to}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                    <motion.path d={pathData} fill="none" stroke={color} strokeWidth={isH ? 5 : 2} strokeOpacity={isH ? 0.25 : 0.45} animate={{ d: pathData }} transition={{ type: 'spring', stiffness: 180, damping: 22 }} />
                    <motion.path d={pathData} fill="none" stroke={color} strokeWidth={isH ? 2.5 : 1.5} className={isH ? 'stroke-dash-animated' : ''} style={{ strokeDasharray: isH ? '8, 6' : undefined }} markerEnd={`url(#${marker})`} animate={{ d: pathData }} transition={{ type: 'spring', stiffness: 180, damping: 22 }} />
                  </motion.g>
                );
              })}
            </AnimatePresence>

            <AnimatePresence>
              {nodes.map((node) => {
                const hh = node.type === 'admin' ? 40 : CARD_HEIGHT / 2;
                const inp = node.type !== 'admin' ? { x: node.x, y: node.y - hh } : null;
                const out = node.type !== 'l4' ? { x: node.x, y: node.y + hh } : null;
                const fill = node.type === 'l2' ? '#10b981' : node.type === 'l3' ? '#8b5cf6' : node.type === 'l4' ? '#0ea5e9' : '#6366f1';
                return (
                  <motion.g key={`ports-${node.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                    {[inp, out].map((port, pi) => port && (
                      <g key={pi}>
                        <motion.circle r={4.5} fill={fill} stroke="white" strokeWidth={1.5}
                          initial={{ cx: node.x, cy: node.y, scale: 0 }}
                          animate={{ cx: port.x, cy: port.y, scale: 1 }}
                          exit={{ scale: 0 }}
                          transition={{ type: 'spring', stiffness: 180, damping: 22 }}
                        />
                        <motion.circle r={1.5} className="fill-background"
                          initial={{ cx: node.x, cy: node.y, scale: 0 }}
                          animate={{ cx: port.x, cy: port.y, scale: 1 }}
                          exit={{ scale: 0 }}
                          transition={{ type: 'spring', stiffness: 180, damping: 22 }}
                        />
                      </g>
                    ))}
                  </motion.g>
                );
              })}
            </AnimatePresence>
          </svg>

          <AnimatePresence>
            {nodes.map((node) => {
              const isH = highlightedNodeId === node.id;
              const hh = node.type === 'admin' ? 40 : CARD_HEIGHT / 2;
              const tx = node.x - CARD_WIDTH / 2;
              const ty = node.y - hh;
              const pn = node.parentId ? nodes.find((n) => n.id === node.parentId) : null;
              const phh = pn?.type === 'admin' ? 40 : CARD_HEIGHT / 2;
              const sx = pn ? pn.x - CARD_WIDTH / 2 : tx;
              const sy = pn ? pn.y - (phh ?? hh) : ty;

              const childCount = countChildren(
                node.data?.id || 'root',
                node.type,
                hierarchy,
                expandedL1,
                expandedL2,
                expandedL3,
              );

              return (
                <motion.div
                  key={node.id}
                  className="absolute flow-card-node"
                  initial={{ opacity: 0, scale: 0.6, x: sx, y: sy }}
                  animate={{ opacity: 1, scale: isH ? 1.03 : 1, x: tx, y: ty }}
                  exit={{ opacity: 0, scale: 0.6, x: sx, y: sy }}
                  transition={{ type: 'spring', stiffness: 180, damping: 22 }}
                  style={{ left: 0, top: 0, width: CARD_WIDTH, zIndex: isH ? 10 : 1 }}
                >
                  {node.type === 'admin' && (
                    <RootNode
                      title={hierarchy.rootTitle}
                      subtitle={hierarchy.rootSubtitle}
                      isHighlighted={isH}
                      onClick={() => setHighlightedNodeId(node.id)}
                    />
                  )}
                  {node.type === 'l1' && (
                    <L1Card
                      data={node.data}
                      isExpanded={expandedL1.has(node.data.id)}
                      isHighlighted={isH}
                      childCount={childCount}
                      onToggleExpand={() => toggle(setExpandedL1, node.data.id)}
                      onOpenDrawer={() => setSelectedEntity({ id: node.data.id, type: 'l1', data: node.data })}
                      showExpand={!node.data.isTier || childCount > 0}
                    />
                  )}
                  {node.type === 'l2' && (
                    <L2Card
                      data={node.data}
                      isExpanded={expandedL2.has(node.data.id)}
                      isHighlighted={isH}
                      childCount={childCount}
                      onToggleExpand={() => toggle(setExpandedL2, node.data.id)}
                      onOpenDrawer={() => setSelectedEntity({ id: node.data.id, type: 'l2', data: node.data })}
                    />
                  )}
                  {node.type === 'l3' && (
                    <L3Card
                      data={node.data}
                      isExpanded={expandedL3.has(node.data.id)}
                      isHighlighted={isH}
                      childCount={childCount}
                      onToggleExpand={() => toggle(setExpandedL3, node.data.id)}
                      onOpenDrawer={() => setSelectedEntity({ id: node.data.id, type: 'l3', data: node.data })}
                    />
                  )}
                  {node.type === 'l4' && (
                    <L4Card
                      data={node.data}
                      isHighlighted={isH}
                      onOpenDrawer={() => setSelectedEntity({ id: node.data.id, type: 'l4', data: node.data })}
                    />
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      </div>

      <div className="absolute bottom-5 left-5 z-20 bg-card/80 border border-border/80 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-lg flex items-center gap-3 floating-toolbar">
        <button onClick={() => handleZoom(0.85)} title="Zoom Out" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors">
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="text-xs font-bold text-foreground min-w-[36px] text-center select-none">{Math.round(scale * 100)}%</span>
        <button onClick={() => handleZoom(1.15)} title="Zoom In" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors">
          <ZoomIn className="h-4 w-4" />
        </button>
        <div className="h-4 w-px bg-border mx-1" />
        <button onClick={handleResetView} title="Reset View" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors flex items-center gap-1">
          <Maximize2 className="h-4 w-4" />
          <span className="text-[10px] font-semibold">Reset</span>
        </button>
      </div>

      <div className="absolute bottom-5 right-5 z-20 bg-card/85 border border-border/80 backdrop-blur-md px-4 py-3.5 rounded-xl shadow-lg hidden lg:block select-none pointer-events-none min-w-[200px]">
        <h4 className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Hierarchy Levels</h4>
        <div className="space-y-1.5 text-xs text-foreground">
          {legendItems.map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={`h-2.5 w-2.5 rounded ${color}`} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <Sheet open={selectedEntity !== null} onOpenChange={(open) => !open && setSelectedEntity(null)}>
        <SheetContent className="sm:max-w-md md:max-w-lg w-full bg-card/95 border-l border-border backdrop-blur-lg flex flex-col p-0 shadow-2xl z-[100]">
          {selectedEntity && (
            <EntityDetailsDrawer
              entityType={selectedEntity.type}
              entityId={selectedEntity.id}
              data={selectedEntity.data}
              hierarchy={hierarchy}
              onClose={() => setSelectedEntity(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
