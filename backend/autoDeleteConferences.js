const Conference = require('./models/Conference');
const CompletedConference = require('./models/CompletedConference');
const axios = require('axios');

// Automatically archive & delete conferences 30 minutes after their END time
// (or 30 min after start time if no endDate is set)
async function autoDeleteExpiredConferences() {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago

  // Find all non-cancelled conferences where the end (or start) time has passed the cutoff
  const allConferences = await Conference.find({
    status: { $nin: ['cancelled'] },
  });

  const expired = allConferences.filter((conf) => {
    const expiryTime = conf.endDate ? new Date(conf.endDate) : new Date(conf.date);
    return expiryTime <= cutoff;
  });

  const adminToken = process.env.ADMIN_JWT_TOKEN;

  for (const conf of expired) {
    try {
      // Always archive to CompletedConference before deleting
      const alreadyArchived = await CompletedConference.findOne({ originalId: conf._id });
      if (!alreadyArchived) {
        await CompletedConference.create({
          originalId: conf._id,
          title: conf.title,
          description: conf.description,
          date: conf.date,
          endDate: conf.endDate,
          speaker: conf.speaker,
          meetingLink: conf.meetingLink,
          department: conf.department,
          poster: conf.poster,
          schedule: conf.schedule,
          maxAttendees: conf.maxAttendees,
          attendeeCount: conf.attendeeCount,
          status: 'completed',
          createdBy: conf.createdBy,
          createdAt: conf.createdAt,
        });
        console.log(`Archived conference to CompletedConference: ${conf.title} (${conf._id})`);
      }

      // Delete the Zoho meeting if applicable
      if (conf.meetingLink && conf.meetingLink.includes('zoho.in')) {
        const match = conf.meetingLink.match(/zoho\.in\/meeting\/(.+)$/);
        if (match && match[1]) {
          try {
            await axios.delete(
              `${process.env.INTERNAL_API_URL || 'http://localhost:5000'}/api/meetings/zoho/${match[1]}`,
              { headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {} }
            );
          } catch (err) {
            console.error('Failed to delete Zoho meeting during auto-delete:', err.message);
          }
        }
      }

      // Now delete from the live conferences collection
      await Conference.findByIdAndDelete(conf._id);
      console.log(`Auto-deleted expired conference: ${conf.title} (${conf._id})`);
    } catch (err) {
      console.error('Auto-delete failed for conference', conf._id, err.message);
    }
  }
}

module.exports = function scheduleConferenceAutoDelete() {
  // Run immediately on server start, then every 5 minutes
  autoDeleteExpiredConferences();
  setInterval(autoDeleteExpiredConferences, 5 * 60 * 1000);
};

