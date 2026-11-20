import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="app-recovery">
        <section className="panel app-recovery-content" role="alert">
          <h1>화면을 표시하지 못했어요.</h1>
          <button type="button" className="button button-accent" onClick={() => this.setState({ failed: false })}>
            다시 시도
          </button>
        </section>
      </main>
    );
  }
}
