/**
 * AI-based Conference Recommendation System
 * Uses keyword matching for simple recommendations
 */

/**
 * Get conference recommendations for user
 * @param userInterests - User's interests or keywords
 * @param allConferences - All available conferences
 */
exports.getRecommendations = (userInterests, allConferences) => {
  if (!userInterests || userInterests.length === 0) {
    return allConferences.slice(0, 5); // Return top 5 if no interests
  }

  // Score each conference based on keyword matching
  const scored = allConferences.map((conference) => {
    let score = 0;
    const description = (conference.description + ' ' + conference.title).toLowerCase();

    userInterests.forEach((interest) => {
      const keyword = interest.toLowerCase();
      const matches = (description.match(new RegExp(keyword, 'g')) || []).length;
      score += matches * 10;
    });

    // Boost score for upcoming conferences
    if (new Date(conference.date) > new Date()) {
      score += 5;
    }

    return {
      ...conference,
      recommendationScore: score,
    };
  });

  // Sort by score and return top recommendations
  return scored
    .filter((conf) => conf.recommendationScore > 0)
    .sort((a, b) => b.recommendationScore - a.recommendationScore)
    .slice(0, 5);
};

/**
 * Get recommendations based on user's department
 */
exports.getDepartmentRecommendations = (userDepartment, allConferences) => {
  return allConferences.filter(
    (conference) => conference.department === userDepartment || conference.department === 'ALL'
  );
};

/**
 * Get trending conferences (most registered)
 */
exports.getTrendingConferences = (conferences) => {
  return conferences
    .sort((a, b) => b.attendeeCount - a.attendeeCount)
    .slice(0, 5);
};
