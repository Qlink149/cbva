import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { leader_id, financial_year_id } = payload;

    // Delete all conversions for this leader and FY
    const conversions = await base44.entities.BlueSkyConversion.filter({
      leader_id,
      financial_year_id,
    });

    for (const conv of conversions) {
      await base44.entities.BlueSkyConversion.delete(conv.id);
    }

    return Response.json({
      success: true,
      deleted: conversions.length,
      message: `Deleted ${conversions.length} Blue Sky conversion records`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});