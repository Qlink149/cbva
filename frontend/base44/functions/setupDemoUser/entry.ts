import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only admins can run this
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Use the current admin user for now (they can manually invite mm@cbva.com later)
    const userId = user.id;
    const userName = user.full_name || 'Leader';

    // Get or create current FY
    const fys = await base44.asServiceRole.entities.FinancialYear.list();
    let currentFY = fys.find(f => f.is_current) || fys.find(f => f.label === 'FY 26-27');
    
    if (!currentFY) {
      const fy = await base44.asServiceRole.entities.FinancialYear.create({
        label: 'FY 26-27',
        start_date: '2026-04-01',
        end_date: '2027-03-31',
        is_current: true,
      });
      currentFY = fy;
    }

    // Create baseline matching Excel targets (₹82.1 Cr Green, ₹41 Cr Amber, ₹40.3 Cr Blue Sky)
    const baseline = await base44.asServiceRole.entities.BaselinePlan.create({
      leader_id: userId,
      leader_name: userName,
      financial_year_id: currentFY.id,
      baseline_green: 821000000,
      baseline_amber: 410000000,
      baseline_blue_sky: 403000000,
      baseline_total: 1634000000,
      is_locked: false,
    });

    // Create engagement type
    let engType = await base44.asServiceRole.entities.EngagementType.list();
    if (engType.length === 0) {
      engType = await base44.asServiceRole.entities.EngagementType.create({ name: 'Advisory', is_active: true });
    } else {
      engType = engType[0];
    }

    // Create sample clients matching Excel
    const clients = [];
    const clientNames = [
      'IMA and Filiar', 'Phoenix', 'Phoenix (Promoters)', 'Malesh', 'Vedanta', 'Dholier Saurashtra',
      'Unidentified-blue sky', 'Musk Bhavishya', 'Bestiguys', 'HDI', 'KinB Seth', 'NIR', 'Vasudev',
      'Radisson Investment', 'Athish Pratap', 'Relife', 'TJ Approx Sharma', 'Baldez', 'Unobserved-blue sky'
    ];

    for (const name of clientNames) {
      const client = await base44.asServiceRole.entities.Client.create({
        name,
        type: 'Corporate',
        primary_industry: 'Finance',
        status: 'Active',
      });
      clients.push(client);
    }

    // Create engagements matching Excel data (Green ₹82.1 Cr, Amber ₹41 Cr, Blue Sky ₹40.3 Cr)
    const greenAmounts = [18500000, 15000000, 7400000, 9900000, 9800000, 6500000, 15800000];
    const amberAmounts = [8000000, 3000000, 1500000, 3000000];
    const blueSkyAmounts = [6000000, 7800000, 7000000, 10600000, 2500000, 1000000];

    // Create Green engagements
    for (let i = 0; i < greenAmounts.length && i < clients.length; i++) {
      await base44.asServiceRole.entities.Engagement.create({
        financial_year_id: currentFY.id,
        client_id: clients[i].id,
        client_name: clients[i].name,
        leader_id: userId,
        leader_name: userName,
        person_responsible_id: userId,
        person_responsible_name: userName,
        engagement_type_id: engType.id,
        engagement_type_name: 'Advisory',
        status: 'Green',
        amount: greenAmounts[i],
        el_signed: 'Signed',
        el_signed_date: '2026-04-15',
        description: `Advisory engagement for ${clients[i].name}`,
      });
    }

    // Create Amber engagements
    for (let i = 0; i < amberAmounts.length && (i + greenAmounts.length) < clients.length; i++) {
      await base44.asServiceRole.entities.Engagement.create({
        financial_year_id: currentFY.id,
        client_id: clients[i + greenAmounts.length].id,
        client_name: clients[i + greenAmounts.length].name,
        leader_id: userId,
        leader_name: userName,
        person_responsible_id: userId,
        person_responsible_name: userName,
        engagement_type_id: engType.id,
        engagement_type_name: 'Advisory',
        status: 'Amber',
        amount: amberAmounts[i],
        el_signed: 'Not Signed',
        remarks: 'Awaiting client approval',
        description: `Pending engagement for ${clients[i + greenAmounts.length].name}`,
      });
    }

    // Create Blue Sky engagements
    for (let i = 0; i < blueSkyAmounts.length && (i + greenAmounts.length + amberAmounts.length) < clients.length; i++) {
      await base44.asServiceRole.entities.Engagement.create({
        financial_year_id: currentFY.id,
        client_id: clients[i + greenAmounts.length + amberAmounts.length].id,
        client_name: clients[i + greenAmounts.length + amberAmounts.length].name,
        leader_id: userId,
        leader_name: userName,
        person_responsible_id: userId,
        person_responsible_name: userName,
        engagement_type_id: engType.id,
        engagement_type_name: 'Advisory',
        status: 'Blue Sky',
        blue_sky_subtype: i % 2 === 0 ? 'Identified' : 'Unidentified',
        amount: blueSkyAmounts[i],
        description: `Blue Sky opportunity for ${clients[i + greenAmounts.length + amberAmounts.length].name}`,
      });
    }

    // Create team members
    const tm1 = await base44.asServiceRole.entities.TeamMember.create({
      full_name: 'Rajesh Kumar',
      designation: 'Senior Manager',
      email: 'rajesh@cbva.com',
      leader_id: userId,
      status: 'Active',
      joining_date: '2024-01-15',
    });

    const tm2 = await base44.asServiceRole.entities.TeamMember.create({
      full_name: 'Priya Singh',
      designation: 'Manager',
      email: 'priya@cbva.com',
      leader_id: userId,
      status: 'Active',
      joining_date: '2025-06-01',
    });

    // Create monthly plan lines matching Excel collections (₹2-3 Cr range)
    const months = ['2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01', '2027-03-01'];
    const monthlyExpected = [28700000, 29200000, 27100000, 26900000, 24700000, 28900000, 27400000, 27200000, 26500000, 28200000, 27700000, 29100000];
    const monthlyActual = [28600000, 27900000, 26100000, 25800000, 23600000, 27800000, 26200000, 26100000, 25400000, 27100000, 26600000, 28000000];

    for (let i = 0; i < months.length; i++) {
      await base44.asServiceRole.entities.MonthlyPlanLine.create({
        leader_id: userId,
        financial_year_id: currentFY.id,
        month: months[i],
        expected_collection: monthlyExpected[i],
        actual_collection: monthlyActual[i],
      });
    }

    // Create tasks matching Excel action items
    const taskTitles = [
      { title: 'Final tax position letter', client: clients[0]?.name, priority: 'High', deadline: '2026-05-25' },
      { title: 'Internal audit follow-up', client: clients[1]?.name, priority: 'Medium', deadline: '2026-06-10' },
      { title: 'Compliance documentation', client: clients[2]?.name, priority: 'High', deadline: '2026-05-30' },
      { title: 'Board approval pending', client: clients[3]?.name, priority: 'Urgent', deadline: '2026-05-22' },
      { title: 'Transfer pricing analysis', client: clients[4]?.name, priority: 'Medium', deadline: '2026-06-15' },
    ];

    for (const task of taskTitles.slice(0, 2)) {
      await base44.asServiceRole.entities.Task.create({
        title: task.title,
        created_by_id: userId,
        assignee_id: tm1.id,
        assignee_name: tm1.full_name,
        client_name: task.client,
        priority: task.priority,
        deadline: task.deadline,
        status: 'In Progress',
      });
    }

    return Response.json({
      success: true,
      message: 'Demo data seeded successfully',
      user: { id: userId, email: user.email, name: userName },
      dataCreated: {
        baseline: baseline.id,
        engagements: greenAmounts.length + amberAmounts.length + blueSkyAmounts.length,
        clients: clients.length,
        teamMembers: 2,
        monthlyLines: months.length,
        tasks: 2,
      }
    });
  } catch (error) {
    console.error('Setup error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});