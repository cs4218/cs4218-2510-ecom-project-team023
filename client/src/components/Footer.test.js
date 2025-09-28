// Some tests written with help of AI
import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom/extend-expect';
import Footer from './Footer';

describe('Footer Component', () => {
  it('renders footer text correctly', () => {
    const { getByText } = render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    expect(getByText(/All Rights Reserved/i)).toBeInTheDocument();
    expect(getByText(/TestingComp/i)).toBeInTheDocument();
  });

  it('renders About, Contact, and Privacy Policy links', () => {
    const { getByText } = render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );

    const aboutLink = getByText('About');
    const contactLink = getByText('Contact');
    const policyLink = getByText('Privacy Policy');

    expect(aboutLink).toBeInTheDocument();
    expect(contactLink).toBeInTheDocument();
    expect(policyLink).toBeInTheDocument();

    expect(aboutLink.closest('a')).toHaveAttribute('href', '/about');
    expect(contactLink.closest('a')).toHaveAttribute('href', '/contact');
    expect(policyLink.closest('a')).toHaveAttribute('href', '/policy');
  });
  
});
