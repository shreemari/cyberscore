import React from 'react';
import type { NextPageContext } from 'next';

// Custom Pages-router error component to override Next.js 15.1.3's broken
// built-in fallback. Without this, `next build` fails on /404 and /_error
// with React minified error #31 ("object with keys {$$typeof, type, key,
// ref, props}") during static prerendering on React 19.
//
// Using React.createElement directly (no JSX) sidesteps any JSX-runtime
// weirdness that's been observed with React 19 + Next 15.1.x.
//
// Once Next.js is upgraded past the bug (>=15.2.x), this file can go.

interface ErrorProps {
  statusCode?: number;
}

class ErrorPage extends React.Component<ErrorProps> {
  static getInitialProps({ res, err }: NextPageContext): ErrorProps {
    const statusCode = res?.statusCode ?? err?.statusCode ?? 404;
    return { statusCode };
  }

  render() {
    const { statusCode } = this.props;
    return React.createElement(
      'main',
      { style: { fontFamily: 'system-ui, sans-serif', padding: 24 } },
      React.createElement('h1', null, String(statusCode ?? 'Error')),
      React.createElement(
        'p',
        null,
        'This is an API. See /api/v1/health.',
      ),
    );
  }
}

export default ErrorPage;
