import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

/**
 * שכבת הגנה (Error Boundary) שמונעת קריסה למסך לבן ומציגה הודעת שחזור ידידותית למשתמש.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'אירעה שגיאה בלתי צפויה בטעינת הרכיב.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100dvh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            backgroundColor: '#f0ebe9',
            direction: 'rtl',
          }}
        >
          <div
            style={{
              maxWidth: '480px',
              width: '100%',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 8px 24px rgba(5, 56, 86, 0.16)',
              textAlign: 'right',
            }}
          >
            <h2 style={{ color: '#053856', marginBottom: '10px', fontSize: '20px' }}>
              אופס! אירעה תקלה זמנית בתצוגה
            </h2>
            <p style={{ color: '#4a4a4a', fontSize: '14px', lineHeight: 1.5, marginBottom: '16px' }}>
              אפשר לחזור מיד למערכת ללא אובדן מידע.
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                window.location.reload();
              }}
              style={{
                backgroundColor: '#053856',
                color: '#ffffff',
                border: 'none',
                borderRadius: '20px',
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              🔄 רענון המערכת
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
