import React, { useState, useEffect } from 'react';
import { Cup } from './ui.jsx';

export default function ProductImage({ product, id }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [product.image_path]);
  return product.image_path && !failed
    ? <img className="drink-photo" src={product.image_path} alt={product.name} loading="lazy" onError={() => setFailed(true)} />
    : <Cup color={product.color} id={id} />;
}
