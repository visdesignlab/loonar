---
sidebar_position: 1
---

# What is Loon

How do cancer cells grow, divide, proliferate and die? How do drugs influence these processes? These are difficult questions that many attempt to answer with a combination of time-series microscopy experiments, classification algorithms, and data visualization. 

However, collecting this type of data and applying algorithms to segment and track cells and construct lineages of proliferation is error-prone; and identifying the errors can be challenging since it often requires cross-checking multiple data types. Similarly, analyzing and communicating the results necessitates synthesizing different data types into a single narrative. State-of-the-art visualization methods for such data use independent line charts, tree diagrams, and images in separate views. 

However, this spatial separation requires the viewer of these charts to combine the relevant pieces of data in memory. To simplify this challenging task, we describe design principles for weaving cell images, time-series data, and tree data into a cohesive visualization. Our design principles are based on choosing a primary data type that drives the layout and integrates the other data types into that layout.
