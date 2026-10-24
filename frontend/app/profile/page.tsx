"use client";

import { Nav, useAuth } from "../components";

export default function ProfilePage() {
  const { user } = useAuth();

  return <div className="product-shell"><Nav active="profile" /><main className="page-container profile-page">
    <header className="page-heading profile-heading"><p className="eyebrow">ACCOUNT</p><h1>Your profile</h1><p>Manage your personal details and sign-in for Loopdesk.</p></header>
    <section className="profile-overview">
      <div className="profile-identity profile-card card">
        <div className="profile-identity-top"><span className="profile-live-dot" /> Active account</div>
        {user?.picture ? <img className="profile-card-avatar" src={user.picture} alt={`${user.name} profile`} referrerPolicy="no-referrer" /> : <div className="profile-card-avatar profile-card-fallback">{user?.name?.slice(0, 1).toUpperCase() || "U"}</div>}
        <h2>{user?.name || "Your account"}</h2><p>{user?.email || "No email available"}</p>
        <span className="profile-provider"><span>✓</span> Google account connected</span>
        <form action="/api/auth/logout" method="post"><button className="sign-out-button" type="submit">Sign out</button></form>
      </div>
      <div className="profile-details card"><div className="profile-details-heading"><p className="eyebrow">PERSONAL INFORMATION</p><h2>Account details</h2><p>Details shared by your Google account.</p></div>
        <dl className="profile-detail-list"><div><dt>Full name</dt><dd>{user?.name || "—"}</dd></div><div><dt>Email address</dt><dd>{user?.email || "—"}<span className="profile-verified">Verified</span></dd></div><div><dt>Sign-in method</dt><dd><span className="google-g-mark" aria-hidden="true">G</span> Google</dd></div></dl>
        <div className="profile-security-note"><span>✓</span><p><strong>Secure sign-in</strong><small>Your account is protected by Google authentication.</small></p></div>
      </div>
    </section>
  </main></div>;
}
