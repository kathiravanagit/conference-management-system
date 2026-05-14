import React from 'react';
import { FaGlobe, FaEnvelope, FaMapMarkerAlt } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => {
    const currentYear = new Date().getFullYear();

    return (
        <footer className="footer">
            <div className="footer-glow" />
            <div className="footer-container">
                <div className="footer-top">
                    <div className="footer-brand">
                        <Link to="/" className="footer-logo">
                            <span className="footer-logo-mark">ConferenceHub</span>
                            <span className="footer-logo-sub">Academic Events Platform</span>
                        </Link>
                        <p className="footer-college">
                            <FaMapMarkerAlt />
                            Manakula Vinayagar Institute of Technology
                        </p>
                        <p className="footer-tagline">
                            Empowering academic conferences with seamless registration,
                            live meetings, certificates, and real-time engagement.
                        </p>
                        <div className="footer-socials">
                            <a
                                href="https://mvit.edu.in/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="social-link"
                                aria-label="College Website"
                            >
                                <FaGlobe />
                                <span>mvit.edu.in</span>
                            </a>
                            <a
                                href="mailto:contactus@mvit.edu.in"
                                className="social-link"
                                aria-label="Email"
                            >
                                <FaEnvelope />
                                <span>Contact</span>
                            </a>
                        </div>
                    </div>

                    <div className="footer-links-group">
                        <div className="footer-col">
                            <h4>Platform</h4>
                            <Link to="/conferences">Conferences</Link>
                            <Link to="/analytics">Analytics</Link>
                            <Link to="/meetings">Meetings</Link>
                        </div>
                        <div className="footer-col">
                            <h4>Account</h4>
                            <Link to="/login">Login</Link>
                            <Link to="/register">Register</Link>
                            <Link to="/account/profile">Profile</Link>
                        </div>
                        <div className="footer-col">
                            <h4>For Staff</h4>
                            <Link to="/staff/dashboard">Dashboard</Link>
                            <Link to="/staff/dashboard">Create Conference</Link>
                            <Link to="/staff/dashboard">Manage Q&A</Link>
                        </div>
                    </div>
                </div>

                <div className="footer-divider" />

                <div className="footer-bottom">
                    <p className="footer-copyright">
                        © Kathiravan@{currentYear} — All rights reserved.
                    </p>
                    <p className="footer-powered">
                        Made for MVIT
                    </p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
