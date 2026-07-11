import { DESIGNATION_ORDER, designationRank, sortByDesignation } from '@/lib/designations';

function tierId(leaderId, designation) {
  return `tier-${leaderId}-${designation}`;
}

function activeMembers(members) {
  return (members || []).filter((m) => m.status !== 'Inactive');
}

function groupByDesignation(members) {
  const groups = {};
  for (const m of members) {
    const desig = m.designation || 'Other';
    if (!groups[desig]) groups[desig] = [];
    groups[desig].push(m);
  }
  return groups;
}

function sortedDesignations(designations) {
  return [...designations].sort((a, b) => designationRank(a) - designationRank(b));
}

function hiringCountForDesig(hiringReqs, desig) {
  return (hiringReqs || []).filter((h) => h.level === desig && h.status !== 'Filled').length;
}

/**
 * Build hierarchy arrays for a single leader's team.
 * Hybrid: explicit reports_to tree + designation-tier fallback.
 */
export function buildLeaderHierarchy({ leaderId, leaderName, teamMembers = [], hiringReqs = [] }) {
  const members = activeMembers(teamMembers);
  const memberById = Object.fromEntries(members.map((m) => [m.id, m]));
  const l1 = [];
  const l2 = [];
  const l3 = [];
  const l4 = [];
  const placed = new Set();

  const childrenMap = {};
  for (const m of members) {
    if (m.reports_to_member_id && memberById[m.reports_to_member_id]) {
      if (!childrenMap[m.reports_to_member_id]) childrenMap[m.reports_to_member_id] = [];
      childrenMap[m.reports_to_member_id].push(m);
    }
  }

  function placeInTree(m, level, parentId, grandparentId) {
    if (placed.has(m.id)) return;
    placed.add(m.id);

    const children = (childrenMap[m.id] || []).sort(sortByDesignation);
    const base = {
      id: m.id,
      name: m.full_name,
      title: m.full_name,
      designation: m.designation,
      email: m.email,
      status: m.status,
      joining_date: m.joining_date,
      raw: m,
      isMember: true,
      memberCount: children.length,
    };

    if (level === 1) {
      l1.push(base);
    } else if (level === 2) {
      l2.push({ ...base, parentId });
    } else if (level === 3) {
      l3.push({ ...base, parentId, grandparentId });
    } else {
      l4.push({ ...base, parentId, title: m.full_name });
    }

    for (const child of children) {
      const nextLevel = Math.min(level + 1, 4);
      if (nextLevel === 2) placeInTree(child, 2, m.id);
      else if (nextLevel === 3) placeInTree(child, 3, m.id, parentId);
      else placeInTree(child, 4, m.id);
    }
  }

  const reportTargets = new Set(
    members.filter((m) => m.reports_to_member_id && memberById[m.reports_to_member_id])
      .map((m) => m.reports_to_member_id),
  );

  const treeRoots = members
    .filter((m) => reportTargets.has(m.id))
    .filter((m) => !m.reports_to_member_id || !memberById[m.reports_to_member_id])
    .sort(sortByDesignation);

  for (const root of treeRoots) {
    placeInTree(root, 1);
  }

  const remaining = members.filter((m) => !placed.has(m.id));
  const designationGroups = groupByDesignation(remaining);

  for (const desig of sortedDesignations(Object.keys(designationGroups))) {
    const tid = tierId(leaderId, desig);
    const groupMembers = designationGroups[desig];
    l1.push({
      id: tid,
      name: desig,
      designation: desig,
      status: 'Active',
      memberCount: groupMembers.length,
      isTier: true,
      hiringCount: hiringCountForDesig(hiringReqs, desig),
    });
    for (const m of groupMembers.sort(sortByDesignation)) {
      placed.add(m.id);
      l2.push({
        id: m.id,
        name: m.full_name,
        parentId: tid,
        designation: m.designation,
        email: m.email,
        status: m.status,
        joining_date: m.joining_date,
        raw: m,
      });
    }
  }

  return {
    rootTitle: leaderName || leaderId || 'Leader',
    rootSubtitle: `${members.length} team member${members.length !== 1 ? 's' : ''}`,
    l1,
    l2,
    l3,
    l4,
    allMembers: members,
    memberById,
  };
}

/**
 * Build firmwide hierarchy: CBVA root -> leaders -> per-leader subtrees.
 */
export function buildFirmwideHierarchy({ leaders = [], teamMembers = [], hiringReqs = [] }) {
  const activeLeaders = (leaders || []).filter((l) => l.is_active !== false);
  const members = activeMembers(teamMembers);

  const l1 = activeLeaders.map((ldr) => {
    const leaderMembers = members.filter((m) => m.leader_id === ldr.id);
    return {
      id: `leader-${ldr.id}`,
      name: ldr.name,
      designation: ldr.practice || 'Business Leader',
      email: ldr.email || '',
      status: 'Active',
      memberCount: leaderMembers.length,
      isLeader: true,
      leaderId: ldr.id,
      raw: ldr,
    };
  });

  const l2 = [];
  const l3 = [];
  const l4 = [];

  for (const ldr of activeLeaders) {
    const leaderMembers = members.filter((m) => m.leader_id === ldr.id);
    const leaderHiring = (hiringReqs || []).filter((h) => h.leader_id === ldr.id);
    const subtree = buildLeaderHierarchy({
      leaderId: ldr.id,
      leaderName: ldr.name,
      teamMembers: leaderMembers,
      hiringReqs: leaderHiring,
    });

    const leaderNodeId = `leader-${ldr.id}`;

    for (const node of subtree.l1) {
      l2.push({
        ...node,
        id: `${ldr.id}-${node.id}`,
        parentId: leaderNodeId,
        leaderId: ldr.id,
      });
    }

    for (const node of subtree.l2) {
      l3.push({
        ...node,
        id: `${ldr.id}-${node.id}`,
        parentId: `${ldr.id}-${node.parentId}`,
        grandparentId: leaderNodeId,
        leaderId: ldr.id,
      });
    }

    for (const node of subtree.l3) {
      l4.push({
        ...node,
        id: `${ldr.id}-${node.id}`,
        parentId: `${ldr.id}-${node.parentId}`,
        grandparentId: node.grandparentId ? `${ldr.id}-${node.grandparentId}` : leaderNodeId,
        leaderId: ldr.id,
      });
    }

    for (const node of subtree.l4) {
      l4.push({
        ...node,
        id: `${ldr.id}-${node.id}`,
        parentId: `${ldr.id}-${node.parentId}`,
        leaderId: ldr.id,
      });
    }
  }

  return {
    rootTitle: 'CBVA',
    rootSubtitle: `${activeLeaders.length} leaders · ${members.length} members`,
    l1,
    l2,
    l3,
    l4,
    allMembers: members,
    memberById: Object.fromEntries(members.map((m) => [m.id, m])),
  };
}

export function getReportsToName(member, memberById, leaderName) {
  if (!member?.reports_to_member_id) return leaderName || 'Leader (by designation)';
  const parent = memberById?.[member.reports_to_member_id];
  return parent?.full_name || 'Unknown';
}
