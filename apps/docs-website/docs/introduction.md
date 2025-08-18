---
sidebar_position: 1
---

# What is Loon

## Data Visualization Software for Live Cell Microscopy
Loon is a tool for scientists to **analyze** cell data, **identify** data processing mistakes, and **communicate** their findings.

>Loon is designed to visualize cell data **already generated** from other microscopy software _(E.g. [LiveCyte](https://www.phasefocus.com/livecyte), [TrackMate](https://imagej.net/plugins/trackmate/))_.
>
> Loon **does not** create cell segmentation outlines itself, or derive metadata _(e.g. mass, time, segmentations)_ from images.  
> Instead, Loon is made to visualize cell images and metadata as [input](./getting-started-with-loon/index.md).  
>
> Loon software does not modify your underlying microscopy data. It is a data visualization tool only.

## Why
How do cancer cells grow, divide, proliferate and die? How do drugs influence these processes? These are difficult questions that many attempt to answer with a combination of time-series microscopy experiments, classification algorithms, and data visualization. 

However, collecting this type of data and applying algorithms to segment and track cells and construct lineages of proliferation is error-prone; and identifying the errors can be challenging since it often requires cross-checking multiple data types. Similarly, analyzing and communicating the results necessitates synthesizing different data types into a single narrative. State-of-the-art visualization methods for such data use independent line charts, tree diagrams, and images in separate views. 

However, this spatial separation requires the viewer of these charts to combine the relevant pieces of data in memory. To simplify this challenging task, we describe design principles for weaving cell images, time-series data, and tree data into a cohesive visualization. Our design principles are based on choosing a primary data type that drives the layout and integrates the other data types into that layout.