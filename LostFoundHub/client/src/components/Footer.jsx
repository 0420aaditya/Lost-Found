// components/Footer.jsx
// Site footer, matching the one used on the static pages: a dark band with
// the brand, quick links and contact details.
import { Link } from "react-router-dom";

function Footer() {
  return (
    <footer>
      <div className="container">
        <div className="footer-content">
          <div className="footer-logo">
            <h2>Lost &amp; Found Hub</h2>
            <p>Reconnecting people with their belongings since 2023.</p>
          </div>

          <div className="footer-links">
            <h3>Quick Links</h3>
            <ul>
              <li>
                <Link to="/">Home</Link>
              </li>
              <li>
                <Link to="/items?type=lost">Lost Items</Link>
              </li>
              <li>
                <Link to="/items?type=found">Found Items</Link>
              </li>
              <li>
                <Link to="/submit">Report Item</Link>
              </li>
            </ul>
          </div>

          <div className="footer-contact">
            <h3>Contact Us</h3>
            <p>
              <i className="fas fa-envelope"></i> info@lostandfoundhub.com
            </p>
            <p>
              <i className="fas fa-phone"></i> (123) 456-7890
            </p>
            <div className="social-icons">
              <a href="#" aria-label="Facebook">
                <i className="fab fa-facebook"></i>
              </a>
              <a href="#" aria-label="Twitter">
                <i className="fab fa-twitter"></i>
              </a>
              <a href="#" aria-label="Instagram">
                <i className="fab fa-instagram"></i>
              </a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; 2023 Lost &amp; Found Hub. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
