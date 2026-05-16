jest.mock('../models/Registration');
jest.mock('../models/Conference');
jest.mock('../models/User');
jest.mock('../models/Notification');
jest.mock('../models/Certificate');
jest.mock('../utils/email');
jest.mock('../utils/helpers');
jest.mock('../utils/certificate', () => ({ generateCertificate: jest.fn().mockResolvedValue('/uploads/cert.pdf') }));

const Registration = require('../models/Registration');
const Conference = require('../models/Conference');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Certificate = require('../models/Certificate');
const emailUtils = require('../utils/email');
const helpers = require('../utils/helpers');

const { registerForConference, cancelRegistration } = require('../controllers/registrationController');
const { generateCertificate } = require('../controllers/certificateController');

describe('Registration controller (unit)', () => {
  beforeEach(() => jest.resetAllMocks());

  test('registerForConference reserves a seat when available', async () => {
    const req = {
      body: { conferenceId: 'conf1' },
      user: { id: 'user1' },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    Conference.findById = jest.fn().mockResolvedValue({ _id: 'conf1', maxAttendees: 2, registrationDeadline: null, status: 'upcoming' });
    Registration.findOne = jest.fn().mockResolvedValue(null);
    // Conference.findOneAndUpdate will return updatedConference (meaning seat reserved)
    Conference.findOneAndUpdate = jest.fn().mockResolvedValue({ _id: 'conf1', attendeeCount: 1, maxAttendees: 2 });
    helpers.generateTicketNumber = jest.fn().mockReturnValue('TICKET-123');
    Registration.create = jest.fn().mockResolvedValue({ _id: 'reg1', userId: 'user1', conferenceId: 'conf1', status: 'registered' });
    User.findById = jest.fn().mockResolvedValue({ _id: 'user1', email: 'u@example.com', name: 'User' });
    emailUtils.sendRegistrationEmail = jest.fn().mockResolvedValue(true);
    Notification.create = jest.fn().mockResolvedValue(true);

    await registerForConference(req, res, jest.fn());

    expect(Conference.findById).toHaveBeenCalledWith('conf1');
    expect(Conference.findOneAndUpdate).toHaveBeenCalled();
    expect(Registration.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
