import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { formatDate, handleApiError } from '../../utils/helpers';
import Loading from '../../components/ui/Loading';
import ErrorMessage from '../../components/ui/ErrorMessage';
import './CertificatePage.css';

const CertificatePage = () => {
  const { certificateId } = useParams();
  const navigate = useNavigate();
  const [certificate, setCertificate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  const fetchCert = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/certificates/my');
      const cert = response.data.certificates?.find((c) => c._id === certificateId);
      if (!cert) {
        setError('Certificate not found');
        return;
      }
      setCertificate(cert);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  }, [certificateId]);

  useEffect(() => {
    fetchCert();
  }, [fetchCert]);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const response = await axios.get(`/api/certificates/${certificateId}/download`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `certificate-${certificate.certificateNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download certificate');
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Certificate',
          text: `I earned a certificate for ${certificate?.conferenceId?.title}!`,
          url: window.location.href,
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    } else {
      // Fallback: Copy link to clipboard
      navigator.clipboard.writeText(window.location.href);
      alert('Certificate link copied to clipboard!');
    }
  };

  if (loading) return <Loading />;

  if (!certificate) {
    return (
      <div className="certificate-container">
        <ErrorMessage message={error || 'Certificate not found'} />
        <button onClick={() => navigate('/my-registrations')} className="btn">
          Back to My Registrations
        </button>
      </div>
    );
  }

  return (
    <div className="certificate-container">
      <div className="certificate-card">
        <div className="certificate-header">
          <h2>Certificate of Completion</h2>
          <span className="certificate-number">
            Certificate #: {certificate.certificateNumber}
          </span>
        </div>

        <div className="certificate-details">
          <div className="detail-item">
            <span className="detail-label">Earned For:</span>
            <span className="detail-value">{certificate.conferenceId?.title}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Issued To:</span>
            <span className="detail-value">{certificate.userId?.name}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Attendance Hours:</span>
            <span className="detail-value">{certificate.attendanceHours} hours</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Date Earned:</span>
            <span className="detail-value">{formatDate(certificate.createdAt)}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Downloads:</span>
            <span className="detail-value">{certificate.downloadCount} times</span>
          </div>
        </div>

        <div className="certificate-actions">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="btn btn-primary"
          >
            {downloading ? 'Downloading...' : 'Download PDF'}
          </button>
          <button onClick={handlePrint} className="btn btn-secondary">
            Print
          </button>
          <button onClick={handleShare} className="btn btn-secondary">
            Share
          </button>
        </div>

        <div className="certificate-info">
          <h4>What This Certificate Proves</h4>
          <ul>
            <li>You successfully attended the conference</li>
            <li>You completed the required attendance hours</li>
            <li>This certificate can be shared on LinkedIn and other platforms</li>
            <li>Your attendance has been verified and recorded</li>
          </ul>
        </div>

        <div className="certificate-footer">
          <p>For inquiries, contact: admin@conferencehub.edu</p>
        </div>

        <div className="certificate-navigation">
          <button onClick={() => navigate('/my-registrations')} className="btn">
            Back to My Registrations
          </button>
        </div>
      </div>
    </div>
  );
};

export default CertificatePage;
