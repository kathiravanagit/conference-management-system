import React from 'react';
import './RatingForm.css';

const RatingForm = ({ onSubmit }) => {
  const [rating, setRating] = React.useState(5);
  const [comment, setComment] = React.useState('');
  const [categories, setCategories] = React.useState({
    speakerQuality: 5,
    contentRelevance: 5,
    timeManagement: 5,
    venueExperience: 5,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      rating,
      comment,
      categories,
    });
  };

  const handleCategoryChange = (category, value) => {
    setCategories({
      ...categories,
      [category]: parseInt(value),
    });
  };

  return (
    <form className="rating-form" onSubmit={handleSubmit}>
      <h3>Rate This Conference</h3>

      <div className="form-group">
        <label>Overall Rating *</label>
        <div className="rating-stars">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              className={`star ${rating >= star ? 'active' : ''}`}
              onClick={() => setRating(star)}
            >
              Rate
            </button>
          ))}
        </div>
        <p className="rating-value">{rating}/5</p>
      </div>

      <div className="form-group">
        <label>Speaker Quality</label>
        <input
          type="range"
          min="1"
          max="5"
          value={categories.speakerQuality}
          onChange={(e) => handleCategoryChange('speakerQuality', e.target.value)}
        />
        <span>{categories.speakerQuality}/5</span>
      </div>

      <div className="form-group">
        <label>Content Relevance</label>
        <input
          type="range"
          min="1"
          max="5"
          value={categories.contentRelevance}
          onChange={(e) => handleCategoryChange('contentRelevance', e.target.value)}
        />
        <span>{categories.contentRelevance}/5</span>
      </div>

      <div className="form-group">
        <label>Time Management</label>
        <input
          type="range"
          min="1"
          max="5"
          value={categories.timeManagement}
          onChange={(e) => handleCategoryChange('timeManagement', e.target.value)}
        />
        <span>{categories.timeManagement}/5</span>
      </div>

      <div className="form-group">
        <label>Venue Experience</label>
        <input
          type="range"
          min="1"
          max="5"
          value={categories.venueExperience}
          onChange={(e) => handleCategoryChange('venueExperience', e.target.value)}
        />
        <span>{categories.venueExperience}/5</span>
      </div>

      <div className="form-group">
        <label htmlFor="comment">Additional Comments</label>
        <textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your thoughts..."
          maxLength="1000"
          rows="4"
        />
      </div>

      <button type="submit" className="submit-btn">
        Submit Feedback
      </button>
    </form>
  );
};

export default RatingForm;
