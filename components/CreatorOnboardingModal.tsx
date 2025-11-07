'use client';

import { useState } from 'react';

interface CreatorOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreatorOnboardingModal({ isOpen, onClose }: CreatorOnboardingModalProps) {
  const [formData, setFormData] = useState({
    creatorName: '',
    channelUrl: '',
    email: '',
    reason: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const response = await fetch('/api/creator-onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to submit');
      }

      setSubmitStatus('success');
      setFormData({
        creatorName: '',
        channelUrl: '',
        email: '',
        reason: '',
      });

      // Close modal after 2 seconds
      setTimeout(() => {
        onClose();
        setSubmitStatus('idle');
      }, 2000);
    } catch (error) {
      console.error('Error submitting form:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-surface-dark border border-border-subtle rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border-subtle">
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-text-light to-accent-cool">
            Onboard Your Favorite Creator
          </h2>
          <button
            onClick={onClose}
            className="text-text-light hover:text-accent-cool transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <p className="text-text-muted text-sm">
            Help us bring your favorite YouTube creator&apos;s content to our platform. We&apos;ll review your request and work on adding their videos to our knowledge graph.
          </p>

          {/* Creator Name */}
          <div>
            <label htmlFor="creatorName" className="block text-sm font-medium text-text-light mb-2">
              Creator Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="creatorName"
              required
              value={formData.creatorName}
              onChange={(e) => setFormData({ ...formData, creatorName: e.target.value })}
              className="w-full px-4 py-2.5 bg-surface-base border border-border-subtle rounded-lg text-text-light placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-cool/50 focus:border-accent-cool transition-all"
              placeholder="e.g., TechReviewer, ScienceExplainer"
            />
          </div>

          {/* Channel URL */}
          <div>
            <label htmlFor="channelUrl" className="block text-sm font-medium text-text-light mb-2">
              YouTube Channel URL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              id="channelUrl"
              required
              value={formData.channelUrl}
              onChange={(e) => setFormData({ ...formData, channelUrl: e.target.value })}
              className="w-full px-4 py-2.5 bg-surface-base border border-border-subtle rounded-lg text-text-light placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-cool/50 focus:border-accent-cool transition-all"
              placeholder="https://www.youtube.com/@channelname"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-text-light mb-2">
              Your Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2.5 bg-surface-base border border-border-subtle rounded-lg text-text-light placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-cool/50 focus:border-accent-cool transition-all"
              placeholder="your.email@example.com"
            />
            <p className="mt-1 text-xs text-text-muted">
              We&apos;ll notify you when the creator is added
            </p>
          </div>

          {/* Reason */}
          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-text-light mb-2">
              Why should we onboard this creator?
            </label>
            <textarea
              id="reason"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              rows={4}
              className="w-full px-4 py-2.5 bg-surface-base border border-border-subtle rounded-lg text-text-light placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-cool/50 focus:border-accent-cool transition-all resize-none"
              placeholder="Tell us what makes this creator's content valuable..."
            />
          </div>

          {/* Status Messages */}
          {submitStatus === 'success' && (
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-green-400 text-sm font-medium">
                Thank you! We&apos;ve received your request and will review it soon.
              </p>
            </div>
          )}

          {submitStatus === 'error' && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm font-medium">
                Oops! Something went wrong. Please try again.
              </p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-sm font-medium text-text-light border border-border-subtle rounded-lg hover:bg-surface-base transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-accent-cool to-accent-warm hover:from-accent-cool/80 hover:to-accent-warm/80 rounded-lg shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
