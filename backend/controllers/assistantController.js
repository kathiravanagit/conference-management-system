const ChatFAQ = require('../models/ChatFAQ');

// ─── Stop-words to ignore during keyword extraction ───────────────────────────
const STOP_WORDS = new Set([
    'a', 'an', 'the', 'is', 'it', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'but',
    'not', 'with', 'this', 'that', 'my', 'i', 'can', 'do', 'how', 'what', 'where', 'when',
    'why', 'will', 'should', 'would', 'could', 'are', 'was', 'were', 'be', 'been', 'have',
    'has', 'had', 'does', 'did', 'which', 'who', 'please', 'tell', 'me', 'about', 'give',
    'want', 'need', 'get', 'use', 'set', 'also', 'any', 'all'
]);

/**
 * Extract meaningful keywords from a sentence.
 */
function extractKeywords(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Score a FAQ against query keywords.
 * Returns a number 0-1.
 */
function scoreMatch(faq, queryKeywords) {
    if (!queryKeywords.length) return 0;
    const faqWords = new Set(faq.keywords);
    const matches = queryKeywords.filter((k) => faqWords.has(k)).length;
    return matches / queryKeywords.length;
}

// ─── Pre-seeded FAQ knowledge base ────────────────────────────────────────────
const SEED_FAQS = [
    // --- General ---
    {
        question: 'What is ConferenceHub?',
        answer: 'ConferenceHub is an Academic Events Platform that lets students register for conferences, join live meetings, earn certificates, and track their participation. Staff can create and manage conferences from the dashboard.',
        keywords: ['conferencehub', 'platform', 'system', 'app', 'website'],
        category: 'general',
    },
    {
        question: 'Who can use ConferenceHub?',
        answer: 'ConferenceHub is for Students and Staff. Students can register for conferences, download certificates, and view their participation. Staff can create conferences, manage registrations, and upload certificates.',
        keywords: ['use', 'user', 'student', 'staff', 'role', 'access'],
        category: 'general',
    },
    // --- Registration ---
    {
        question: 'How do I register for a conference?',
        answer: 'Go to the Conferences page, find the conference you want to join, and click "Register". You must be logged in as a student to register.',
        keywords: ['register', 'registration', 'join', 'signup', 'attend', 'conference'],
        category: 'registration',
    },
    {
        question: 'How do I cancel my registration?',
        answer: 'Go to "My Tickets" in the navigation menu. Find the registration you want to cancel and click the "Cancel" button. Cancellation is only allowed before the conference starts.',
        keywords: ['cancel', 'unregister', 'remove', 'registration', 'ticket'],
        category: 'registration',
    },
    {
        question: 'Where can I see my registrations?',
        answer: 'Click on "My Tickets" in the top navigation bar to see all your registered conferences along with their status.',
        keywords: ['my', 'ticket', 'registration', 'booked', 'registered', 'view'],
        category: 'registration',
    },
    {
        question: 'How many conferences can I register for?',
        answer: 'You can register for as many conferences as you want, as long as seats are available (within the maxAttendees limit set by the staff).',
        keywords: ['many', 'multiple', 'limit', 'max', 'conferences', 'register'],
        category: 'registration',
    },
    // --- Conferences ---
    {
        question: 'How do I find upcoming conferences?',
        answer: 'Go to the Conferences page. You can filter by Department and Status (Upcoming, Ongoing, Completed). By default it shows upcoming conferences.',
        keywords: ['upcoming', 'find', 'discover', 'browse', 'conference', 'list', 'search'],
        category: 'conference',
    },
    {
        question: 'What does conference status mean?',
        answer: 'Upcoming – conference has not started yet. Ongoing – conference is currently live. Completed – conference has ended. Cancelled – conference was cancelled by the organizer.',
        keywords: ['status', 'ongoing', 'upcoming', 'completed', 'cancelled', 'meaning'],
        category: 'conference',
    },
    {
        question: 'Can I see conferences from other departments?',
        answer: 'On the Conferences page you can filter by any department. In the Meetings page, only your own department\'s conferences and "ALL" department conferences are shown.',
        keywords: ['other', 'department', 'dept', 'filter', 'conference', 'see', 'display'],
        category: 'conference',
    },
    // --- Meetings ---
    {
        question: 'How do I join a live meeting?',
        answer: 'Go to the Meetings page. Under "Ongoing Now", find the conference and click "Join Live Meeting". You can only join if you are registered for that conference.',
        keywords: ['join', 'meeting', 'live', 'link', 'video', 'zoom', 'online'],
        category: 'meeting',
    },
    {
        question: 'Why can\'t I see any meetings?',
        answer: 'The Meetings page only shows ongoing and upcoming conferences for YOUR department. Make sure you are logged in and your department matches the conference department. Conferences set to "ALL" are visible to everyone.',
        keywords: ['meeting', 'empty', 'show', 'visible', 'see', 'not', 'nothing'],
        category: 'meeting',
    },
    // --- Certificates ---
    {
        question: 'How do I get my certificate?',
        answer: 'Certificates are available in the Participation page after your attendance is marked by the staff. Click "Download Certificate" next to the conference to download it.',
        keywords: ['certificate', 'download', 'get', 'receive', 'attend'],
        category: 'certificate',
    },
    {
        question: 'When will my certificate be available?',
        answer: 'Your certificate is available after the conference ends and the staff marks your attendance and enables certificates. Contact your staff if it\'s not showing.',
        keywords: ['certificate', 'available', 'when', 'ready', 'appear'],
        category: 'certificate',
    },
    // --- QR & Attendance ---
    {
        question: 'What is the QR code for?',
        answer: 'Your QR code acts as your digital event ticket. Staff can scan it using the QR Scanner on the Staff Dashboard to mark your attendance at the conference.',
        keywords: ['qr', 'code', 'scan', 'attendance', 'ticket', 'barcode'],
        category: 'registration',
    },
    {
        question: 'Where is my QR code?',
        answer: 'Go to "My Tickets", find your registered conference, and click "QR Code" to view and download your unique QR ticket.',
        keywords: ['qr', 'code', 'where', 'find', 'my', 'ticket'],
        category: 'registration',
    },
    // --- Leaderboard ---
    {
        question: 'How does the leaderboard work?',
        answer: 'Points are earned by attending conferences. The Leaderboard ranks all students by their total points. The more conferences you attend, the higher you rank!',
        keywords: ['leaderboard', 'points', 'rank', 'score', 'compete', 'position'],
        category: 'leaderboard',
    },
    {
        question: 'How do I earn points?',
        answer: 'You earn points each time your attendance is marked at a conference. Check the Leaderboard to see your current rank and total points.',
        keywords: ['earn', 'points', 'score', 'how', 'get'],
        category: 'leaderboard',
    },
    // --- Account ---
    {
        question: 'How do I change my password?',
        answer: 'Click on your profile icon in the top-right corner, go to Account Settings, then click "Password". Enter your current and new password and save.',
        keywords: ['password', 'change', 'update', 'reset', 'forgot'],
        category: 'account',
    },
    {
        question: 'How do I enable two-factor authentication?',
        answer: 'Go to your Account Settings and click on "Two-Factor Auth". Click "Enable 2FA" and scan the QR code using Google Authenticator or Authy. Enter the 6-digit code to verify and save your backup codes.',
        keywords: ['two', 'factor', '2fa', 'authentication', 'security', 'enable', 'otp'],
        category: 'account',
    },
    {
        question: 'How do I update my profile?',
        answer: 'Click on your profile icon in the top navigation bar and go to Account Settings → Profile. You can update your name, department, and phone number.',
        keywords: ['profile', 'update', 'edit', 'name', 'account', 'settings'],
        category: 'account',
    },
    // --- Staff ---
    {
        question: 'How do I create a conference as staff?',
        answer: 'Go to the Staff Dashboard. Fill out the Create Conference form with the title, description, speaker details, start and end date/time, department, and meeting link. Click "Create Conference" to publish it.',
        keywords: ['create', 'conference', 'staff', 'new', 'publish', 'add', 'dashboard'],
        category: 'staff',
    },
    {
        question: 'How do I scan student QR codes?',
        answer: 'Go to the Staff Dashboard and click "QR Scanner" under a conference. Allow camera access and point it at the student\'s QR code to mark their attendance.',
        keywords: ['scan', 'qr', 'scanner', 'attendance', 'mark', 'student', 'camera'],
        category: 'staff',
    },
    {
        question: 'How do I upload certificates for students?',
        answer: 'In the Staff Dashboard, go to the "Upload Certificate" section. Select the conference and the student, then upload the PDF certificate file.',
        keywords: ['upload', 'certificate', 'staff', 'pdf', 'student'],
        category: 'staff',
    },
    {
        question: 'How do staff delete a conference?',
        answer: 'In the Staff Dashboard, find the conference in the Ongoing or Upcoming section and click "Delete". Only the creator of the conference can delete it.',
        keywords: ['delete', 'remove', 'conference', 'cancel', 'staff'],
        category: 'staff',
    },
];

// ─── Seed FAQs on startup ──────────────────────────────────────────────────────
let seeded = false;
async function seedFAQs() {
    if (seeded) return;
    seeded = true;
    const count = await ChatFAQ.countDocuments({ source: 'seed' });
    if (count === 0) {
        await ChatFAQ.insertMany(SEED_FAQS.map((f) => ({ ...f, source: 'seed' })));
        console.log('✅ Virtual assistant FAQ knowledge base seeded.');
    }
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/assistant/ask
 * Body: { question: String }
 * Returns the best matching answer.
 */
exports.ask = async (req, res) => {
    try {
        await seedFAQs();
        const { question } = req.body;

        if (!question || question.trim().length < 2) {
            return res.status(400).json({ success: false, message: 'Please provide a question.' });
        }

        const queryKeywords = extractKeywords(question);
        const allFAQs = await ChatFAQ.find({});

        // Score every FAQ
        const scored = allFAQs
            .map((faq) => ({ faq, score: scoreMatch(faq, queryKeywords) }))
            .filter((s) => s.score > 0)
            .sort((a, b) => b.score - a.score);

        if (scored.length === 0) {
            return res.json({
                success: true,
                matched: false,
                answer:
                    "I'm sorry, I don't have an answer for that yet. Please contact your staff or check the Conferences page for more information.",
            });
        }

        const best = scored[0];

        // Increment hit count
        await ChatFAQ.findByIdAndUpdate(best.faq._id, { $inc: { hitCount: 1 } });

        return res.json({
            success: true,
            matched: true,
            answer: best.faq.answer,
            category: best.faq.category,
            score: best.score,
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/assistant/faqs
 * Returns all FAQs (for admin visibility or suggestions)
 */
exports.getFAQs = async (req, res) => {
    try {
        await seedFAQs();
        const faqs = await ChatFAQ.find({}).sort({ hitCount: -1 });
        res.json({ success: true, faqs });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * GET /api/assistant/suggestions
 * Returns top FAQ questions as suggestion chips
 */
exports.getSuggestions = async (req, res) => {
    try {
        await seedFAQs();
        const faqs = await ChatFAQ.find({}).sort({ hitCount: -1 }).limit(8).select('question category');
        res.json({ success: true, suggestions: faqs });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
