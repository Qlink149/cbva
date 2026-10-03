"""Idempotent KRA seed. Inserts only when a collection / FY slice is empty.

KPI rows are the FY26-27 Leader Scorecard sheet default — not a B2 decision.
Switching to the PerformanceMetric sheet is an admin data edit, not a code change.
"""

from datetime import datetime, timezone

from loguru import logger

from app.core import database

PENDING_4TH = "Pending definition from client"

CATEGORIES = [
    {"_id": "client_delivery", "name": "Client Delivery", "sort_order": 1},
    {"_id": "business_development", "name": "Business Development", "sort_order": 2},
    {"_id": "practice_development", "name": "Practice Development", "sort_order": 3},
    {"_id": "practice_management", "name": "Practice Management", "sort_order": 4},
]

DEFAULT_WEIGHTS = {
    "2627": {
        "client_delivery": 0.30,
        "business_development": 0.35,
        "practice_development": 0.25,
        "practice_management": 0.10,
    },
    "2526": {
        "client_delivery": 0.40,
        "business_development": 0.40,
        "practice_development": 0.10,
        "practice_management": 0.10,
    },
}

# Scorecard sheet column E first line = kpi_name. Band/measurement/frequency from G/H.
# Verbatim from FY26-27_Leader_Scorecard (whitespace collapsed). Blank cells stay "".
KPI_DEFINITIONS_2627 = [
    {
        "category_id": "client_delivery",
        "kpi_name": "Deliver High-Quality Client Service: Be fully accountable for client delivery by respective teams, producing high-quality, impactful work leading to Value Creation (for the firm, for the client, for colleagues)",
        "sub_weight": 0.10,
        "rating_band_text": "3.5-5: Exceptional, 3 to 3.5: 100–120%, 2.5 to 3: 80-100%, 2 to 2.5: 70–80%, 0 to 2: <70%",
        "target_measurement_text": "% of plan achieved - through Business Plan Review. Subject to Behavioral Competency Demonstrations. KPI fill-in: Agreed Plan with the Board for the Current FY.",
        "frequency_source": "Monthly BP Review | BP sheet",
        "sort_order": 1,
    },
    {
        "category_id": "client_delivery",
        "kpi_name": "Ensure all engagements are covered by an Engagement Letter (EL) (Any exception requires a written waiver approved by the Sr. Partner).",
        "sub_weight": 0.05,
        "rating_band_text": "3.5-5: Exceptional, 2.5 to 3.5: 80–100%, 2-2.5: 60-80%, 0-2: <60%",
        "target_measurement_text": "100% of engagements backed by valid CAF, ELs, or other processes/documents. Waivers will be considered. Subject to Behavioral Competency Demonstrations.",
        "frequency_source": "Monthly BP Review | BP sheet",
        "sort_order": 2,
    },
    {
        "category_id": "client_delivery",
        "kpi_name": "Ensure timely collection, either on a monthly or mid-quarter basis (obtain a waiver from the Sr. Partner where collection timelines are genuinely extended).",
        "sub_weight": 0.10,
        "rating_band_text": "3.5-5: Exceptional, 2.5 to 3.5: 90–110%, 2-2.5: 75–90%, 0-2: <75%",
        "target_measurement_text": "Yearly collection achieved monthwise - via finance MIS + Monthly collection as planned achieved.",
        "frequency_source": "Monthly BP Review | BP sheet",
        "sort_order": 3,
    },
    {
        "category_id": "client_delivery",
        "kpi_name": "Client Centricity: Demonstrates sound judgement, reliability, and high standards of delivery that protect client trust and firm reputation",
        "sub_weight": 0.05,
        "rating_band_text": "",
        "target_measurement_text": "Factors to Consider: Ownership of delivery, Quality of output, timeliness & adherence to plan/schedule agreed, proactive communication client feedback, escalation levels",
        "frequency_source": "",
        "sort_order": 4,
    },
    {
        "category_id": "business_development",
        "kpi_name": "Enhance Market Eminence and Visibility; and build Thought Leadership",
        "sub_weight": 0.05,
        "rating_band_text": "3.5-5: Exceptional, 2.5 to 3.5: 90–110%, 2-2.5: 75–90%, 0-2: <75%",
        "target_measurement_text": "Agreed Vs Achieved (themes, articles/bylines, speaking forums).",
        "frequency_source": "Quarterly Review | BP sheet",
        "sort_order": 5,
    },
    {
        "category_id": "business_development",
        "kpi_name": "Proactively go-to-market for new work (including cross-selling) alongside internal firm resources & mitras. [Revenue mix: A-C-L (Advisory, Compliance, Litigation) for DT, IDT and TP leaders]",
        "sub_weight": 0.10,
        "rating_band_text": "3.5-5: Exceptional, 3 to 3.5: 90–110%, 2.5-3: 75–90%, 2-2.5: 60-75%, 0-2: <60%",
        "target_measurement_text": "% of plan achieved - Business Plan sheet: Blue Sky xxL of xxL (xx%). Revenue Mix of A-C-L for DT, IDT, TP Leaders.",
        "frequency_source": "Monthly BP Review | BP sheet",
        "sort_order": 6,
    },
    {
        "category_id": "business_development",
        "kpi_name": "Cross-sell of practice beyond own business area",
        "sub_weight": 0.05,
        "rating_band_text": "3.5-5: Exceptional, 3 to 3.5: 90–110%, 2.5-3: 75–90%, 2-2.5: 60-75%, 0-2: <60%",
        "target_measurement_text": "Cross-sell target: ₹ 100 L (Provisional) (Agreed Vs Actual)",
        "frequency_source": "Quarterly | BP sheet",
        "sort_order": 7,
    },
    {
        "category_id": "business_development",
        "kpi_name": "Engage clients in a full & timely way, including scheduling quarterly client updates with Promoters, Senior Clients, and Involve Senior Leadership",
        "sub_weight": 0.05,
        "rating_band_text": "3.5-5: Exceptional, 3 to 3.5: 90–100%, 2.5-3: 75–90%, 2-2.5: 60-75%, 0-2: <60%",
        "target_measurement_text": "Agreed (As per 'Client Engagement Log') Vs Actual (Waivers to be in place)",
        "frequency_source": "Monthly BP Review | BP sheet",
        "sort_order": 8,
    },
    {
        "category_id": "business_development",
        "kpi_name": "Where relevant, lead client relationships - with relevant guidance from Senior Leadership",
        "sub_weight": 0.05,
        "rating_band_text": "",
        "target_measurement_text": "Agreed Vs Actual Relationship goals per 'Client Engagement Log' in BP Sheet",
        "frequency_source": "Senior Partner Feedback | Monthly BP Review",
        "sort_order": 9,
    },
    {
        "category_id": "business_development",
        "kpi_name": "Commercial Ownership & Execution Discipline: Owns targets, tracks pipeline rigorously, follows through, and balances growth with commercial discipline",
        "sub_weight": 0.05,
        "rating_band_text": "",
        "target_measurement_text": "ME - Behavioral Indicator",
        "frequency_source": "",
        "sort_order": 10,
    },
    {
        "category_id": "practice_development",
        "kpi_name": "Create a succession pipeline within the firm",
        "sub_weight": 0.05,
        "rating_band_text": "",
        "target_measurement_text": "Development of Shadow P&L: Y/N. Progress against Team Development.",
        "frequency_source": "Monthly / Quarterly / Annually",
        "sort_order": 11,
    },
    {
        "category_id": "practice_development",
        "kpi_name": "Drive utilisation & efficiency",
        "sub_weight": 0.05,
        "rating_band_text": "",
        "target_measurement_text": "Leader Benchmark / Practice Benchmark / Firm Benchmark (Revenue Multiple, Income per Colleague)",
        "frequency_source": "Monthly BP Review | Data from FC",
        "sort_order": 12,
    },
    {
        "category_id": "practice_development",
        "kpi_name": "Drive Colleague Engagement & Culture",
        "sub_weight": 0.05,
        "rating_band_text": "",
        "target_measurement_text": "Team EE score: ≥4.0/5.0 (or ≥80% favourable). Team voluntary attrition: ≤15%. Exit feedback: documented action taken.",
        "frequency_source": "Colleague Survey: Annual; Quarterly - HR Dashboard; Pulse Survey Results; Exit Interview Summary",
        "sort_order": 13,
    },
    {
        "category_id": "practice_development",
        "kpi_name": "Take ownership for self-development",
        "sub_weight": 0.05,
        "rating_band_text": "",
        "target_measurement_text": "Feedback from Management Team; Feedback from Performance & Mindset Coach; Target: 90% attendance in Firm Training/Development Events",
        "frequency_source": "Coach Feedback; Line Manager Assessment; 360 Feedback (Annual)",
        "sort_order": 14,
    },
    {
        "category_id": "practice_development",
        "kpi_name": "People Leadership & Capability Building",
        "sub_weight": 0.05,
        "rating_band_text": "",
        "target_measurement_text": "Coaches team members, shares knowledge, develops capability, builds bench strength, promotes a learning culture, reduces dependency on self, provides regular feedback, manages performance consistently, and supports development and accountability",
        "frequency_source": "",
        "sort_order": 15,
    },
    {
        "category_id": "practice_management",
        "kpi_name": "Consistently meeting all firm-established Timelines. Engage all internal stakeholders, providing timely updates & escalations",
        "sub_weight": 0.05,
        "rating_band_text": "",
        "target_measurement_text": "Target: 100% adherence to mandatory requirements and disciplined operating practices",
        "frequency_source": "Monthly BP Review | BP sheet; Feedback from Relevant stakeholders - Finance, HR, COS, Line Manager Assessment",
        "sort_order": 16,
    },
    {
        "category_id": "practice_management",
        "kpi_name": "Judgement, Integrity & Credibility",
        "sub_weight": 0.05,
        "rating_band_text": "",
        "target_measurement_text": "Upholds standards, adheres timelines, exercises sound judgement, escalates risks early, and supports disciplined execution",
        "frequency_source": "",
        "sort_order": 17,
    },
]

COMPETENCIES = [
    {
        "_id": "client_centricity",
        "key": "client_centricity",
        "name": "Client Centricity",
        "weight": 0.05,
        "sort_order": 1,
        "criteria_text": (
            "• Consistently acts in clients’ best interests, within performance frameworks set down by the firm\n"
            "• Owns end-to-end delivery for all engagements\n"
            "• Output quality is consistently high; Identifies and resolves quality risks before they surface\n"
            "• Communicates proactively to clients on status and potential delays\n"
            "• Escalates risks to senior leadership in a timely manner with context and proposed resolution\n"
            "• Clients proactively seek out this leader for additional work"
        ),
    },
    {
        "_id": "commercial_ownership",
        "key": "commercial_ownership",
        "name": "Commercial Ownership & Execution Discipline",
        "weight": 0.05,
        "sort_order": 2,
        "criteria_text": (
            "• Fully owns business targets; monitors pipeline, manages gaps, and drives conversion with appropriate direction from senior leadership\n"
            "• Demonstrate commercial awareness across all stages of the business lifecycle - relationship-building, business development (negotiations, pricing), client delivery (colleague utilisation), engagement closure (billing, collections)\n"
            "• Takes ownership of client outcomes, and organises team / tasks / meetings accordingly - working backward from due-dates\n"
            "• Engenders outcomes-driven planning among team members"
        ),
    },
    {
        "_id": "people_leadership",
        "key": "people_leadership",
        "name": "People Leadership & Emotional Regulation",
        "weight": 0.05,
        "sort_order": 3,
        "criteria_text": (
            "• Holds structured, meaningful performance conversations at the agreed cadence\n"
            "• Encourages high-performance, manages feedback and underperformance consistently\n"
            "• Supports, leverages & empowers teams to grow\n"
            "• Creates a learning culture (e.g. knowledge-sharing, post-engagement reviews etc)\n"
            "• Demonstrates self-awareness; adjusts approach based on context, individual needs, and feedback received\n"
            "• Openly expresses limitations & works with stakeholders to overcome these (e.g. capacity challenges, feelings of stress)\n"
            "• Remains composed and solution-focused under pressure, does not let stress or frustration drive decisions or interactions\n"
            "• Is resilient & recovers fast from setbacks\n"
            "• Role-models professionalism & business maturity for colleagues"
        ),
    },
    {
        "_id": "judgement_integrity_credibility",
        "key": "judgement_integrity_credibility",
        "layer": "all_time",
        "fiscal_year": None,
        "leader_id": None,
        "name": "Judgement, Integrity & Credibility",
        "weight": 0.05,
        "sort_order": 4,
        "criteria_text": PENDING_4TH,
    },
]


_seeded = False


async def ensure_kra_seed() -> None:
    global _seeded
    if _seeded or database.db is None:
        return
    now = datetime.now(timezone.utc)

    await database.db.kpi_definitions.update_many(
        {"layer": {"$exists": False}},
        {"$set": {"layer": "fy", "leader_id": None}},
    )
    await database.db.kra_weight_config.update_many(
        {"layer": {"$exists": False}, "$or": [{"leader_id": None}, {"leader_id": {"$exists": False}}]},
        {"$set": {"layer": "fy"}},
    )
    await database.db.kra_weight_config.update_many(
        {"layer": {"$exists": False}, "leader_id": {"$nin": [None]}},
        {"$set": {"layer": "leader"}},
    )
    async for c in database.db.leadership_competencies.find({"layer": {"$exists": False}}):
        await database.db.leadership_competencies.update_one(
            {"_id": c["_id"]},
            {
                "$set": {
                    "layer": "all_time",
                    "key": c.get("key") or str(c["_id"]),
                    "fiscal_year": None,
                    "leader_id": None,
                }
            },
        )

    if await database.db.kra_categories.count_documents({}) == 0:
        await database.db.kra_categories.insert_many(
            [{**c, "created_at": now, "updated_at": now} for c in CATEGORIES]
        )
        logger.info("Seeded kra_categories (4 rows).")

    if await database.db.leadership_competencies.count_documents({"layer": "all_time"}) == 0:
        stamped = []
        for c in COMPETENCIES:
            stamped.append({
                **c,
                "layer": "all_time",
                "key": c.get("key") or str(c["_id"]),
                "fiscal_year": None,
                "leader_id": None,
                "created_at": now,
                "updated_at": now,
            })
        await database.db.leadership_competencies.insert_many(stamped)
        logger.info("Seeded leadership_competencies all-time (4 rows; 4th criteria pending).")

    if await database.db.kra_weight_config.count_documents({"layer": "all_time"}) == 0:
        await database.db.kra_weight_config.insert_many(
            [
                {
                    "layer": "all_time",
                    "fiscal_year": None,
                    "leader_id": None,
                    "category_id": cat_id,
                    "weight": weight,
                    "created_at": now,
                    "updated_at": now,
                }
                for cat_id, weight in DEFAULT_WEIGHTS["2627"].items()
            ]
        )
        logger.info("Seeded kra_weight_config all-time defaults.")

    for fy, weights in DEFAULT_WEIGHTS.items():
        existing = await database.db.kra_weight_config.count_documents(
            {"layer": "fy", "fiscal_year": fy}
        )
        if existing == 0:
            await database.db.kra_weight_config.insert_many(
                [
                    {
                        "layer": "fy",
                        "fiscal_year": fy,
                        "leader_id": None,
                        "category_id": cat_id,
                        "weight": weight,
                        "created_at": now,
                        "updated_at": now,
                    }
                    for cat_id, weight in weights.items()
                ]
            )
            logger.info("Seeded kra_weight_config FY defaults for {}.", fy)

    if await database.db.kpi_definitions.count_documents({"layer": "all_time"}) == 0:
        await database.db.kpi_definitions.insert_many(
            [
                {
                    "layer": "all_time",
                    "fiscal_year": None,
                    "leader_id": None,
                    "created_at": now,
                    "updated_at": now,
                    **row,
                }
                for row in KPI_DEFINITIONS_2627
            ]
        )
        logger.info(
            "Seeded kpi_definitions all-time from Leader_Scorecard sheet "
            "(starting default only — B2 not decided)."
        )
    _seeded = True
