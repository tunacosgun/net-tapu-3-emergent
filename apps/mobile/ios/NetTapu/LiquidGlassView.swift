import UIKit

/// Native iOS Liquid Glass View — exposes UIVisualEffectView with systemThinMaterial
/// to React Native as a bridged view component.
class LiquidGlassView: UIView {

  // The main frosted glass effect view
  private let effectView: UIVisualEffectView = {
    let blur = UIBlurEffect(style: .systemThinMaterial)
    let view = UIVisualEffectView(effect: blur)
    view.translatesAutoresizingMaskIntoConstraints = false
    return view
  }()

  // The active tab bubble — a second glass layer with extra refraction
  private let bubbleView: UIView = {
    let v = UIView()
    v.translatesAutoresizingMaskIntoConstraints = false
    v.layer.cornerRadius = 22
    v.clipsToBounds = true
    return v
  }()

  private let bubbleBlur: UIVisualEffectView = {
    let blur = UIBlurEffect(style: .systemUltraThinMaterial)
    let view = UIVisualEffectView(effect: blur)
    view.translatesAutoresizingMaskIntoConstraints = false
    view.layer.cornerRadius = 22
    view.clipsToBounds = true
    return view
  }()

  // Chromatic aberration border layer
  private let chromaticBorder = CAGradientLayer()

  // Bubble position constraint
  private var bubbleLeading: NSLayoutConstraint?
  private var bubbleWidth: NSLayoutConstraint?

  // Properties from React Native
  @objc var cornerRadius: CGFloat = 34 {
    didSet {
      effectView.layer.cornerRadius = cornerRadius
      effectView.clipsToBounds = true
      layer.cornerRadius = cornerRadius
      clipsToBounds = false
    }
  }

  @objc var activeIndex: Int = 0 {
    didSet { animateBubble(to: activeIndex) }
  }

  @objc var tabCount: Int = 4 {
    didSet { setNeedsLayout() }
  }

  override init(frame: CGRect) {
    super.init(frame: frame)
    setupView()
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    setupView()
  }

  private func setupView() {
    // Shadow for floating effect
    layer.shadowColor = UIColor.black.cgColor
    layer.shadowOpacity = 0.12
    layer.shadowOffset = CGSize(width: 0, height: 6)
    layer.shadowRadius = 16
    layer.cornerRadius = cornerRadius

    // Add glass effect
    addSubview(effectView)
    NSLayoutConstraint.activate([
      effectView.topAnchor.constraint(equalTo: topAnchor),
      effectView.leadingAnchor.constraint(equalTo: leadingAnchor),
      effectView.trailingAnchor.constraint(equalTo: trailingAnchor),
      effectView.bottomAnchor.constraint(equalTo: bottomAnchor),
    ])
    effectView.layer.cornerRadius = cornerRadius
    effectView.clipsToBounds = true

    // White tint overlay
    let tintView = UIView()
    tintView.backgroundColor = UIColor.white.withAlphaComponent(0.35)
    tintView.translatesAutoresizingMaskIntoConstraints = false
    effectView.contentView.addSubview(tintView)
    NSLayoutConstraint.activate([
      tintView.topAnchor.constraint(equalTo: effectView.contentView.topAnchor),
      tintView.leadingAnchor.constraint(equalTo: effectView.contentView.leadingAnchor),
      tintView.trailingAnchor.constraint(equalTo: effectView.contentView.trailingAnchor),
      tintView.bottomAnchor.constraint(equalTo: effectView.contentView.bottomAnchor),
    ])

    // Bubble container
    bubbleView.backgroundColor = .clear
    effectView.contentView.addSubview(bubbleView)

    // Bubble blur
    bubbleView.addSubview(bubbleBlur)
    NSLayoutConstraint.activate([
      bubbleBlur.topAnchor.constraint(equalTo: bubbleView.topAnchor),
      bubbleBlur.leadingAnchor.constraint(equalTo: bubbleView.leadingAnchor),
      bubbleBlur.trailingAnchor.constraint(equalTo: bubbleView.trailingAnchor),
      bubbleBlur.bottomAnchor.constraint(equalTo: bubbleView.bottomAnchor),
    ])

    // Bubble inner white tint
    let bubbleTint = UIView()
    bubbleTint.backgroundColor = UIColor.white.withAlphaComponent(0.25)
    bubbleTint.translatesAutoresizingMaskIntoConstraints = false
    bubbleTint.layer.cornerRadius = 22
    bubbleTint.clipsToBounds = true
    bubbleView.addSubview(bubbleTint)
    NSLayoutConstraint.activate([
      bubbleTint.topAnchor.constraint(equalTo: bubbleView.topAnchor),
      bubbleTint.leadingAnchor.constraint(equalTo: bubbleView.leadingAnchor),
      bubbleTint.trailingAnchor.constraint(equalTo: bubbleView.trailingAnchor),
      bubbleTint.bottomAnchor.constraint(equalTo: bubbleView.bottomAnchor),
    ])

    // Top reflection line
    let reflection = UIView()
    reflection.backgroundColor = UIColor.white.withAlphaComponent(0.8)
    reflection.translatesAutoresizingMaskIntoConstraints = false
    reflection.layer.cornerRadius = 0.5
    bubbleView.addSubview(reflection)
    NSLayoutConstraint.activate([
      reflection.topAnchor.constraint(equalTo: bubbleView.topAnchor, constant: 1),
      reflection.leadingAnchor.constraint(equalTo: bubbleView.leadingAnchor, constant: 12),
      reflection.trailingAnchor.constraint(equalTo: bubbleView.trailingAnchor, constant: -12),
      reflection.heightAnchor.constraint(equalToConstant: 1),
    ])

    // Bubble constraints
    let leading = bubbleView.leadingAnchor.constraint(equalTo: effectView.contentView.leadingAnchor, constant: 8)
    let width = bubbleView.widthAnchor.constraint(equalToConstant: 80)
    bubbleLeading = leading
    bubbleWidth = width
    NSLayoutConstraint.activate([
      bubbleView.topAnchor.constraint(equalTo: effectView.contentView.topAnchor, constant: 6),
      bubbleView.bottomAnchor.constraint(equalTo: effectView.contentView.bottomAnchor, constant: -6),
      leading,
      width,
    ])

    // Add chromatic aberration border
    setupChromaticBorder()
  }

  private func setupChromaticBorder() {
    // Subtle rainbow-ish border on the bubble
    let borderLayer = CALayer()
    borderLayer.borderWidth = 1.5
    borderLayer.borderColor = UIColor(red: 0.55, green: 0.65, blue: 1.0, alpha: 0.3).cgColor
    borderLayer.cornerRadius = 22
    bubbleView.layer.addSublayer(borderLayer)

    // Store reference for layout updates
    bubbleView.layer.borderWidth = 0.5
    bubbleView.layer.borderColor = UIColor.white.withAlphaComponent(0.6).cgColor
  }

  override func layoutSubviews() {
    super.layoutSubviews()

    guard tabCount > 0 else { return }
    let padding: CGFloat = 8
    let itemWidth = (bounds.width - padding * 2) / CGFloat(tabCount)

    bubbleWidth?.constant = itemWidth - 4
    bubbleLeading?.constant = padding + CGFloat(activeIndex) * itemWidth + 2

    // Update chromatic border sublayers
    for sublayer in bubbleView.layer.sublayers ?? [] {
      if sublayer !== bubbleBlur.layer && sublayer is CALayer && !(sublayer is CAGradientLayer) {
        sublayer.frame = bubbleView.bounds
      }
    }
  }

  private func animateBubble(to index: Int) {
    guard tabCount > 0 else { return }
    let padding: CGFloat = 8
    let itemWidth = (bounds.width - padding * 2) / CGFloat(tabCount)
    let targetX = padding + CGFloat(index) * itemWidth + 2

    // Spring animation for liquid morphing feel
    UIView.animate(
      withDuration: 0.5,
      delay: 0,
      usingSpringWithDamping: 0.65,
      initialSpringVelocity: 0.8,
      options: [.curveEaseInOut],
      animations: {
        self.bubbleLeading?.constant = targetX

        // Squish effect — stretch horizontally, compress vertically during animation
        self.bubbleView.transform = CGAffineTransform(scaleX: 1.08, y: 0.92)
        self.layoutIfNeeded()
      },
      completion: { _ in
        // Bounce back to normal
        UIView.animate(
          withDuration: 0.3,
          delay: 0,
          usingSpringWithDamping: 0.5,
          initialSpringVelocity: 0.3,
          options: [],
          animations: {
            self.bubbleView.transform = .identity
          }
        )
      }
    )
  }
}
